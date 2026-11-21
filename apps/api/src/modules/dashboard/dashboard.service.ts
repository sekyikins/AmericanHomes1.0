import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(restrictFinancials = false) {
    const now = new Date();
    const startOf7d = new Date(now);
    startOf7d.setDate(now.getDate() - 6);
    startOf7d.setHours(0, 0, 0, 0);

    const startOf30d = new Date(now);
    startOf30d.setDate(now.getDate() - 29);
    startOf30d.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [
      inventoryLots,
      activeOrders,
      awaitingCollectionOrders,
      pendingAdjustments,
      pendingPriceApprovals,
      pendingManualPayments,
      salesTotalAgg,
      verifiedPaymentsAgg,
      paidPayments30d,
      latestShipment,
      unexpectedDiscrepancies,
      expiringReservations,
      failedLotsCount,
    ] = await Promise.all([
      this.prisma.stockLot.aggregate({ _sum: { available: true, held: true, unavailable: true } }),
      this.prisma.salesOrder.count({
        where: { orderStatus: { in: ['PLACED', 'CONFIRMED'] } },
      }),
      this.prisma.salesOrder.count({
        where: {
          orderStatus: 'CONFIRMED',
          fulfilmentStatus: { in: ['READY_FOR_COLLECTION', 'PARTIALLY_COLLECTED'] },
        },
      }),
      this.prisma.adjustmentProposal.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.pricingApproval.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      restrictFinancials
        ? Promise.resolve([])
        : this.prisma.payment.findMany({
            where: { status: 'PENDING', method: { in: ['MANUAL', 'CASH', 'BANK_TRANSFER'] } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { order: true },
          }),
      restrictFinancials
        ? Promise.resolve(null)
        : this.prisma.salesOrder.aggregate({
            where: { orderStatus: { not: 'CANCELLED' } },
            _sum: { totalCents: true },
          }),
      restrictFinancials
        ? Promise.resolve(null)
        : this.prisma.payment.aggregate({
            where: { status: 'VERIFIED' },
            _sum: { amountCents: true },
          }),
      restrictFinancials
        ? Promise.resolve([])
        : this.prisma.payment.findMany({
            where: { status: 'VERIFIED', createdAt: { gte: startOf30d } },
            select: { amountCents: true, createdAt: true },
          }),
      this.prisma.shipment.findFirst({
        where: { status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'desc' },
        include: {
          manifestRevisions: { orderBy: { revision: 'desc' }, take: 1, include: { items: true } },
          receivingSessions: {
            include: {
              lines: { include: { discrepancies: { include: { resolution: true } } } },
            },
          },
        },
      }),
      this.prisma.discrepancy.count({
        where: { type: 'UNEXPECTED', resolution: null },
      }),
      this.prisma.reservation.findMany({
        where: {
          status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
          expiresAt: { gte: now, lte: endOfToday },
        },
        include: { variant: true },
      }),
      this.prisma.stockLot.count({
        where: { unavailable: { gt: 0 } },
      }),
    ]);

    const formatAge = (createdAt: Date) => {
      const diffHours = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 3600000));
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h`;
      return `${Math.floor(diffHours / 24)}d`;
    };

    const staffIds = Array.from(
      new Set(
        [
          ...pendingAdjustments.map((a) => a.initiatedBy),
          ...pendingPriceApprovals.map((p) => p.initiatedBy),
          ...pendingManualPayments.map((p) => p.recordedBy),
        ].filter((id): id is string => Boolean(id)),
      ),
    );
    const staffMembers = staffIds.length
      ? await this.prisma.staffProfile.findMany({
          where: { id: { in: staffIds } },
          include: { user: { select: { name: true, email: true } } },
        })
      : [];
    const staffNameById = new Map(
      staffMembers.map((s) => [s.id, s.user?.name || s.user?.email || 'Staff']),
    );

    const approvalQueue = [
      ...pendingAdjustments.map((adj) => ({
        id: adj.id,
        kind: 'ADJUSTMENT' as const,
        reference: `ADJ-${adj.id.slice(-6).toUpperCase()}`,
        title: 'Stock adjustment',
        subtitle: `${adj.reason} · ${adj.quantity >= 0 ? `+${adj.quantity}` : adj.quantity} units`,
        age: formatAge(adj.createdAt),
        tone: 'red' as const,
        initiatedBy: staffNameById.get(adj.initiatedBy) ?? adj.initiatedBy,
        submittedAt: adj.createdAt.toISOString(),
        beforeLabel: 'Previous quantity',
        beforeValue: `${adj.previousQty} units`,
        afterLabel: 'Proposed quantity',
        afterValue: `${adj.proposedQty} units`,
      })),
      ...pendingPriceApprovals.map((prc) => ({
        id: prc.id,
        kind: 'PRICE' as const,
        reference: `PRC-${prc.id.slice(-6).toUpperCase()}`,
        title: 'Price approval',
        subtitle: `Variant ${prc.variantId.slice(-6).toUpperCase()} · ${prc.reason ?? 'Price update'}`,
        age: formatAge(prc.createdAt),
        tone: 'amber' as const,
        initiatedBy: staffNameById.get(prc.initiatedBy) ?? prc.initiatedBy,
        submittedAt: prc.createdAt.toISOString(),
        beforeLabel: 'Current price',
        beforeValue: `GHS ${((prc.previousPriceCents ?? 0) / 100).toLocaleString()}`,
        afterLabel: 'Proposed price',
        afterValue: `GHS ${(prc.proposedPriceCents / 100).toLocaleString()}`,
      })),
      ...pendingManualPayments.map((pay) => {
        const orderRef =
          pay.order?.reference && (pay.order.reference.includes('-') || pay.order.reference.length <= 18)
            ? pay.order.reference
            : `ORD-${pay.orderId.slice(-6).toUpperCase()}`;
        return {
          id: pay.id,
          kind: 'PAYMENT' as const,
          reference: pay.reference ?? `PAY-${pay.id.slice(-6).toUpperCase()}`,
          title: 'Manual payment',
          subtitle: `GHS ${(pay.amountCents / 100).toLocaleString()} · ${orderRef}`,
          age: formatAge(pay.createdAt),
          tone: 'amber' as const,
          initiatedBy:
            (pay.recordedBy ? staffNameById.get(pay.recordedBy) : undefined) ??
            pay.payerName ??
            'Staff',
          submittedAt: pay.createdAt.toISOString(),
          beforeLabel: 'Order total',
          beforeValue: `GHS ${((pay.order?.totalCents ?? 0) / 100).toLocaleString()}`,
          afterLabel: 'Recorded payment',
          afterValue: `GHS ${(pay.amountCents / 100).toLocaleString()}`,
        };
      }),
    ];

    let salesActivity: null | {
      total7dCents: number;
      total30dCents: number;
      bars7d: Array<{ day: string; amountCents: number; pct: number }>;
      bars30d: Array<{ day: string; amountCents: number; pct: number }>;
    } = null;

    if (!restrictFinancials) {
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const daily7d: Array<{ key: string; day: string; amountCents: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        daily7d.push({ key, day: dayLabels[d.getDay()], amountCents: 0 });
      }
      let total7dCents = 0;
      let total30dCents = 0;
      const weeklyBuckets = [0, 0, 0, 0];
      for (const p of paidPayments30d) {
        total30dCents += p.amountCents;
        const pKey = p.createdAt.toISOString().slice(0, 10);
        const match7 = daily7d.find((d) => d.key === pKey);
        if (match7) {
          match7.amountCents += p.amountCents;
          total7dCents += p.amountCents;
        }
        const daysAgo = Math.floor((now.getTime() - p.createdAt.getTime()) / 86400000);
        const bucketIdx = Math.min(3, Math.max(0, 3 - Math.floor(daysAgo / 8)));
        weeklyBuckets[bucketIdx] += p.amountCents;
      }
      const max7d = Math.max(1, ...daily7d.map((d) => d.amountCents));
      const max30d = Math.max(1, ...weeklyBuckets);
      salesActivity = {
        total7dCents,
        total30dCents,
        bars7d: daily7d.map((d) => ({
          day: d.day,
          amountCents: d.amountCents,
          pct: d.amountCents > 0 ? Math.max(10, Math.round((d.amountCents / max7d) * 100)) : 4,
        })),
        bars30d: weeklyBuckets.map((amountCents, idx) => ({
          day: `Wk ${idx + 1}`,
          amountCents,
          pct: amountCents > 0 ? Math.max(10, Math.round((amountCents / max30d) * 100)) : 4,
        })),
      };
    }

    const activeShipment = latestShipment
      ? (() => {
          const manifestCount = (latestShipment.manifestRevisions[0]?.items ?? []).reduce(
            (sum, i) => sum + i.quantity,
            0,
          );
          const allLines = latestShipment.receivingSessions.flatMap((s) => s.lines);
          const receivedCount = allLines.reduce((sum, l) => sum + l.receivedQty, 0);
          const discrepancyCount = allLines.reduce(
            (sum, l) => sum + l.discrepancies.filter((d) => !d.resolution).length,
            0,
          );
          return {
            id: latestShipment.id,
            reference: latestShipment.reference,
            providerName: latestShipment.providerName,
            status: latestShipment.status,
            departureDate: latestShipment.departureDate,
            estimatedArrival: latestShipment.estimatedArrival,
            manifestCount,
            receivedCount,
            discrepancyCount,
          };
        })()
      : null;

    const expiringReservationsValueCents = expiringReservations.reduce(
      (sum, r) => sum + r.quantity * (r.variant?.priceCents ?? 0),
      0,
    );

    return {
      availableInventory: inventoryLots._sum.available ?? 0,
      heldInventory: inventoryLots._sum.held ?? 0,
      unavailableInventory: inventoryLots._sum.unavailable ?? 0,
      activeOrders,
      awaitingCollectionOrders,
      outstandingPaymentsCents: restrictFinancials
        ? null
        : Math.max(
            0,
            (salesTotalAgg?._sum.totalCents ?? 0) -
              (verifiedPaymentsAgg?._sum.amountCents ?? 0),
          ),
      pendingApprovals: approvalQueue.length,
      approvalQueue,
      salesActivity,
      activeShipment,
      operationalAlerts: {
        unexpectedHeldCount: unexpectedDiscrepancies,
        expiringReservationsCount: expiringReservations.length,
        expiringReservationsValueCents,
        failedInspectionCount: failedLotsCount,
      },
    };
  }
}
