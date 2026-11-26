import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nextDocumentNumber } from '../../common/utils/document-number';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';

const VOLUME_EXPENSE_CATEGORIES = new Set([
  'FREIGHT',
  'OCEAN_FREIGHT',
  'SHIPPING',
  'PORT',
  'HAULAGE',
  'TRANSPORT',
  'DEMURRAGE',
]);

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
  ) {}

  // =========================================================================
  // PHASE 3: QUOTATIONS (SOFT QUOTES -> HARD ORDER CONVERSION)
  // =========================================================================

  listQuotes(status?: string) {
    return this.prisma.quotation.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
  }

  async createQuote(
    staffId: string,
    dto: {
      customerId?: string;
      customerName: string;
      customerPhone?: string;
      items: Array<{ variantId: string; quantity: number; unitPriceCents?: number }>;
      validDays?: number;
      depositPercent?: number;
      notes?: string;
    },
  ) {
    if (!dto.customerName?.trim()) {
      throw new BadRequestException('Customer name is required for a quotation');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Quotation requires at least one item');
    }

    const variantIds = dto.items.map((i) => i?.variantId).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (variantIds.length !== dto.items.length) {
      throw new BadRequestException('Every quotation item must include a valid variantId');
    }
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const resolvedItems = dto.items.map((item) => {
      const v = variantMap.get(item.variantId);
      if (!v) throw new NotFoundException(`Variant ${item.variantId} not found`);
      const qty = Math.max(1, Math.round(item.quantity));
      const unitPriceCents =
        typeof item.unitPriceCents === 'number' && item.unitPriceCents > 0
          ? Math.round(item.unitPriceCents)
          : v.priceCents;
      return {
        variantId: v.id,
        sku: v.sku,
        productName: v.product.name,
        quantity: qty,
        unitPriceCents,
      };
    });

    const totalCents = resolvedItems.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
    const depositPct =
      typeof dto.depositPercent === 'number' && dto.depositPercent > 0 && dto.depositPercent <= 100
        ? dto.depositPercent
        : 30;
    const depositRequiredCents = Math.ceil((totalCents * depositPct) / 100);
    const validDays = Math.max(1, Math.min(30, Math.round(dto.validDays ?? 14)));
    const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

    const year = new Date().getFullYear();
    const quote = await this.prisma.$transaction(async (tx) => {
      const reference = await nextDocumentNumber(tx, `QT_${year}`, `AH-QT-${year}`);
      return tx.quotation.create({
        data: {
          reference,
          customerId: dto.customerId,
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone?.trim() || undefined,
          items: resolvedItems as unknown as Prisma.InputJsonValue,
          totalCents,
          depositRequiredCents,
          validUntil,
          status: 'SENT',
          createdBy: staffId,
          notes: dto.notes?.trim() || undefined,
        },
      });
    });

    await this.audit.record({
      actorId: staffId,
      action: 'QUOTATION_CREATED',
      entityType: 'Quotation',
      entityId: quote.id,
      after: { reference: quote.reference, totalCents, depositRequiredCents, validUntil },
    });
    return quote;
  }

  async convertQuoteToOrder(quoteId: string, staffId: string) {
    const quote = await this.prisma.quotation.findUnique({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException(`Quotation ${quoteId} not found`);
    if (quote.status === 'CONVERTED') {
      throw new BadRequestException('Quotation has already been converted to an order');
    }
    if (quote.status === 'CANCELLED' || quote.status === 'EXPIRED') {
      throw new BadRequestException(`Cannot convert a ${quote.status.toLowerCase()} quotation`);
    }
    if (quote.validUntil.getTime() < Date.now()) {
      await this.prisma.quotation.update({ where: { id: quoteId }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Quotation has expired; issue a fresh quote');
    }

    const items = (quote.items as unknown as Array<{
      variantId: string;
      quantity: number;
      unitPriceCents: number;
    }>) ?? [];
    if (items.length === 0) throw new BadRequestException('Quotation has no line items');

    const year = new Date().getFullYear();
    const result = await this.prisma.$transaction(async (tx) => {
      const reference = await nextDocumentNumber(tx, `ORD_${year}`, `AH-ORD-${year}`);
      const order = await tx.salesOrder.create({
        data: {
          reference,
          customerId: quote.customerId ?? undefined,
          source: 'WALK_IN',
          status: 'CONFIRMED',
          orderStatus: 'CONFIRMED',
          paymentStatus: 'PENDING',
          fulfilmentStatus: 'NOT_STARTED',
          totalCents: quote.totalCents,
          notes: `Converted from quotation ${quote.reference}${quote.customerName ? ` (${quote.customerName})` : ''}`,
          lines: {
            create: items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
            })),
          },
        },
        include: { lines: true },
      });

      let lastHoldId: string | undefined;
      for (const line of order.lines) {
        const hold = await this.inventory.commitStock(
          {
            variantId: line.variantId,
            quantity: line.quantity,
            reason: 'QUOTATION_CONVERTED',
            referenceType: 'ORDER',
            referenceId: order.id,
          },
          staffId,
          tx,
        );
        lastHoldId = hold.id;
      }

      // Bounded 24-hour deposit window so stock is released if customer doesn't pay deposit
      await tx.checkoutSession.create({
        data: {
          customerId: quote.customerId ?? undefined,
          orderId: order.id,
          holdId: lastHoldId,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const updatedQuote = await tx.quotation.update({
        where: { id: quoteId },
        data: { status: 'CONVERTED', convertedOrderId: order.id },
      });

      return { quotation: updatedQuote, order };
    });

    await this.audit.record({
      actorId: staffId,
      action: 'QUOTATION_CONVERTED',
      entityType: 'Quotation',
      entityId: quoteId,
      after: { orderId: result.order.id, orderReference: result.order.reference },
    });

    return result;
  }

  async cancelQuote(quoteId: string, staffId: string) {
    const existing = await this.prisma.quotation.findUnique({ where: { id: quoteId } });
    if (!existing) throw new NotFoundException(`Quotation ${quoteId} not found`);
    const updated = await this.prisma.quotation.update({
      where: { id: quoteId },
      data: { status: 'CANCELLED' },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'QUOTATION_CANCELLED',
      entityType: 'Quotation',
      entityId: quoteId,
    });
    return updated;
  }

  // =========================================================================
  // PHASE 4: PROOF OF DELIVERY (POD) & AFTER-SALES WARRANTY SERVICE TICKETS
  // =========================================================================

  async recordProofOfDelivery(
    collectionId: string,
    staffId: string,
    dto: { podSignedBy: string; podPhotoUrl?: string; notes?: string },
  ) {
    const record = await this.prisma.collectionRecord.findUnique({
      where: { id: collectionId },
      include: { lines: true },
    });
    if (!record) throw new NotFoundException(`CollectionRecord ${collectionId} not found`);
    if (!dto.podSignedBy?.trim()) {
      throw new BadRequestException('Recipient sign-off name (podSignedBy) is required');
    }

    const deliveredAt = new Date();
    const updated = await this.prisma.collectionRecord.update({
      where: { id: collectionId },
      data: {
        deliveredAt,
        podSignedBy: dto.podSignedBy.trim(),
        podPhotoUrl: dto.podPhotoUrl?.trim() || undefined,
        notes: dto.notes?.trim()
          ? `${record.notes ? `${record.notes} · ` : ''}POD: ${dto.notes.trim()}`
          : record.notes,
      },
    });

    // Activate warranty start date from Proof of Delivery for any TrackedUnits on these order lines
    const orderLineIds = record.lines.map((l) => l.orderLineId);
    if (orderLineIds.length > 0) {
      const units = await this.prisma.trackedUnit.findMany({
        where: { orderLineId: { in: orderLineIds } },
      });
      for (const u of units) {
        const expires = new Date(deliveredAt);
        expires.setMonth(expires.getMonth() + (u.warrantyMonths || 12));
        await this.prisma.trackedUnit.update({
          where: { id: u.id },
          data: { warrantyExpiresAt: expires, status: 'SOLD' },
        });
      }
    }

    await this.audit.record({
      actorId: staffId,
      action: 'POD_RECORDED',
      entityType: 'CollectionRecord',
      entityId: collectionId,
      after: { podSignedBy: dto.podSignedBy, deliveredAt: deliveredAt.toISOString() },
    });
    return updated;
  }

  listServiceTickets(status?: string) {
    return this.prisma.serviceTicket.findMany({
      where: status ? { status } : undefined,
      include: { trackedUnit: true },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
  }

  async createServiceTicket(
    actorId: string,
    dto: {
      orderId: string;
      trackedUnitId?: string;
      issueType?: string;
      description: string;
      photoUrl?: string;
    },
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { OR: [{ id: dto.orderId }, { reference: dto.orderId }] },
    });
    if (!order) throw new NotFoundException(`SalesOrder ${dto.orderId} not found`);

    const year = new Date().getFullYear();
    const ticket = await this.prisma.$transaction(async (tx) => {
      const reference = await nextDocumentNumber(tx, `SRV_${year}`, `AH-SRV-${year}`);
      return tx.serviceTicket.create({
        data: {
          reference,
          orderId: order.id,
          trackedUnitId: dto.trackedUnitId || undefined,
          customerId: order.customerId ?? undefined,
          issueType: dto.issueType || 'WARRANTY_CLAIM',
          description: dto.description.trim(),
          photoUrl: dto.photoUrl?.trim() || undefined,
          status: 'OPEN',
        },
        include: { trackedUnit: true },
      });
    });

    await this.audit.record({
      actorId,
      action: 'SERVICE_TICKET_CREATED',
      entityType: 'ServiceTicket',
      entityId: ticket.id,
      after: { reference: ticket.reference, orderId: order.id, issueType: ticket.issueType },
    });
    return ticket;
  }

  async updateServiceTicket(
    id: string,
    staffId: string,
    dto: { status?: string; assignedTo?: string; resolutionNotes?: string },
  ) {
    const existing = await this.prisma.serviceTicket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ServiceTicket ${id} not found`);

    const nextStatus = dto.status ?? existing.status;
    const isResolved = ['RESOLVED', 'CLOSED'].includes(nextStatus);
    const updated = await this.prisma.serviceTicket.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(dto.assignedTo !== undefined ? { assignedTo: dto.assignedTo } : {}),
        ...(dto.resolutionNotes !== undefined ? { resolutionNotes: dto.resolutionNotes } : {}),
        ...(isResolved && !existing.resolvedAt ? { resolvedAt: new Date() } : {}),
      },
      include: { trackedUnit: true },
    });

    await this.audit.record({
      actorId: staffId,
      action: 'SERVICE_TICKET_UPDATED',
      entityType: 'ServiceTicket',
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status, resolutionNotes: updated.resolutionNotes },
    });
    return updated;
  }

  // =========================================================================
  // PHASE 5: CASHIER TILL SHIFTS (BLIND CLOSE) & MOMO / BANK RECONCILIATION
  // =========================================================================

  listShifts() {
    return this.prisma.cashierShift.findMany({
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
  }

  async openShift(staffId: string, openingFloatCents: number, notes?: string) {
    const existingOpen = await this.prisma.cashierShift.findFirst({
      where: { staffId, status: 'OPEN' },
    });
    if (existingOpen) {
      throw new BadRequestException(
        `You already have an open shift (${existingOpen.reference}). Close it before opening a new one.`,
      );
    }

    const year = new Date().getFullYear();
    const shift = await this.prisma.$transaction(async (tx) => {
      const reference = await nextDocumentNumber(tx, `SHF_${year}`, `AH-SHF-${year}`);
      return tx.cashierShift.create({
        data: {
          reference,
          staffId,
          status: 'OPEN',
          openingFloatCents: Math.max(0, Math.round(openingFloatCents || 0)),
          notes: notes?.trim() || undefined,
        },
      });
    });

    await this.audit.record({
      actorId: staffId,
      action: 'CASHIER_SHIFT_OPENED',
      entityType: 'CashierShift',
      entityId: shift.id,
      after: { reference: shift.reference, openingFloatCents: shift.openingFloatCents },
    });
    return shift;
  }

  async closeShift(
    shiftId: string,
    staffId: string,
    dto: {
      countedCashCents: number;
      reconciledMomoCents?: number;
      reconciledBankCents?: number;
      notes?: string;
    },
  ) {
    const shift = await this.prisma.cashierShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException(`CashierShift ${shiftId} not found`);
    if (shift.status === 'CLOSED') {
      throw new BadRequestException(`Shift ${shift.reference} is already closed`);
    }

    const closedAt = new Date();
    const [verifiedPayments, processedRefunds] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: 'VERIFIED',
          verifiedAt: { gte: shift.openedAt, lte: closedAt },
        },
        select: { method: true, amountCents: true },
      }),
      this.prisma.refund.findMany({
        where: {
          status: 'PROCESSED',
          processedAt: { gte: shift.openedAt, lte: closedAt },
        },
        include: { payment: { select: { method: true } } },
      }),
    ]);

    let cashIn = 0;
    let momoIn = 0;
    let paystackIn = 0;
    let bankIn = 0;

    for (const p of verifiedPayments) {
      const m = p.method.toUpperCase();
      if (m === 'CASH') cashIn += p.amountCents;
      else if (m === 'MOBILE_MONEY') momoIn += p.amountCents;
      else if (m.startsWith('PAYSTACK')) paystackIn += p.amountCents;
      else if (m === 'BANK_TRANSFER') bankIn += p.amountCents;
    }

    let cashRefunds = 0;
    for (const r of processedRefunds) {
      if (r.payment?.method?.toUpperCase() === 'CASH') {
        cashRefunds += r.amountCents;
      }
    }

    const expectedCashCents = shift.openingFloatCents + cashIn - cashRefunds;
    const countedCashCents = Math.max(0, Math.round(dto.countedCashCents || 0));
    const cashVarianceCents = countedCashCents - expectedCashCents;

    const updated = await this.prisma.cashierShift.update({
      where: { id: shiftId },
      data: {
        status: 'CLOSED',
        closedAt,
        countedCashCents,
        expectedCashCents,
        cashVarianceCents,
        expectedMomoCents: momoIn,
        reconciledMomoCents:
          typeof dto.reconciledMomoCents === 'number'
            ? Math.round(dto.reconciledMomoCents)
            : momoIn,
        expectedPaystackCents: paystackIn,
        expectedBankCents: bankIn,
        reconciledBankCents:
          typeof dto.reconciledBankCents === 'number'
            ? Math.round(dto.reconciledBankCents)
            : bankIn,
        notes: dto.notes?.trim() || shift.notes,
      },
    });

    await this.audit.record({
      actorId: staffId,
      action: 'CASHIER_SHIFT_CLOSED',
      entityType: 'CashierShift',
      entityId: shiftId,
      after: {
        reference: shift.reference,
        expectedCashCents,
        countedCashCents,
        cashVarianceCents,
        expectedMomoCents: momoIn,
        expectedPaystackCents: paystackIn,
        expectedBankCents: bankIn,
      },
    });

    return updated;
  }

  // =========================================================================
  // PHASE 6: SUPPLIERS & FROZEN FX/CBM/VALUE LANDED COST PER LOT
  // =========================================================================

  listSuppliers() {
    return this.prisma.supplier.findMany({
      include: { _count: { select: { shipments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(
    staffId: string,
    dto: {
      name: string;
      country?: string;
      contactName?: string;
      phone?: string;
      email?: string;
      currency?: string;
      notes?: string;
    },
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('Supplier name is required');
    const created = await this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        country: dto.country?.trim() || 'USA',
        contactName: dto.contactName?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        email: dto.email?.trim() || undefined,
        currency: dto.currency?.trim().toUpperCase() || 'USD',
        notes: dto.notes?.trim() || undefined,
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: created.id,
      after: { name: created.name, country: created.country, currency: created.currency },
    });
    return created;
  }

  async freezeShipmentLandedCosts(shipmentId: string, staffId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        expenses: true,
        manifestRevisions: {
          orderBy: { revision: 'desc' },
          take: 1,
          include: { items: true },
        },
        receivingSessions: {
          include: { lines: { include: { stockLots: true } } },
        },
      },
    });
    if (!shipment) throw new NotFoundException(`Shipment ${shipmentId} not found`);

    const items = shipment.manifestRevisions[0]?.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException('Shipment has no manifest items to cost');
    }

    const fx = shipment.fxRateToGhs > 0 ? shipment.fxRateToGhs : 1;
    let volumeExpensesCents = 0;
    let valueExpensesCents = 0;
    for (const exp of shipment.expenses) {
      if (VOLUME_EXPENSE_CATEGORIES.has(exp.category.toUpperCase())) {
        volumeExpensesCents += exp.amountCents;
      } else {
        valueExpensesCents += exp.amountCents;
      }
    }

    const totalCbm = items.reduce((s, i) => s + Math.max(0, i.cbm) * Math.max(1, i.quantity), 0);
    const totalFobGhsCents = items.reduce(
      (s, i) => s + Math.round(Math.max(0, i.unitCostCents) * fx) * Math.max(1, i.quantity),
      0,
    );
    const totalUnits = Math.max(1, items.reduce((s, i) => s + Math.max(1, i.quantity), 0));

    const results: Array<{
      manifestItemId: string;
      productName: string;
      fobGhsUnitCents: number;
      allocatedFreightUnitCents: number;
      allocatedDutyUnitCents: number;
      frozenLandedUnitCostCents: number;
      updatedLots: number;
    }> = [];

    for (const item of items) {
      const qty = Math.max(1, item.quantity);
      const fobGhsUnitCents = Math.round(Math.max(0, item.unitCostCents) * fx);
      const lineFobGhs = fobGhsUnitCents * qty;
      const lineCbm = Math.max(0, item.cbm) * qty;

      const volumeShare =
        totalCbm > 0 && lineCbm > 0
          ? lineCbm / totalCbm
          : totalFobGhsCents > 0
            ? lineFobGhs / totalFobGhsCents
            : qty / totalUnits;
      const valueShare = totalFobGhsCents > 0 ? lineFobGhs / totalFobGhsCents : qty / totalUnits;

      const allocatedFreightUnitCents = Math.round((volumeExpensesCents * volumeShare) / qty);
      const allocatedDutyUnitCents = Math.round((valueExpensesCents * valueShare) / qty);
      const frozenLandedUnitCostCents =
        fobGhsUnitCents + allocatedFreightUnitCents + allocatedDutyUnitCents;

      const lotIds = shipment.receivingSessions
        .flatMap((s) => s.lines)
        .filter((l) => l.manifestItemId === item.id)
        .flatMap((l) => l.stockLots.map((lot) => lot.id));

      let updatedLots = 0;
      if (lotIds.length > 0) {
        const res = await this.prisma.stockLot.updateMany({
          where: { id: { in: lotIds } },
          data: { landedUnitCostCents: frozenLandedUnitCostCents },
        });
        updatedLots = res.count;
      } else if (item.variantId) {
        const res = await this.prisma.stockLot.updateMany({
          where: { variantId: item.variantId, landedUnitCostCents: 0 },
          data: { landedUnitCostCents: frozenLandedUnitCostCents },
        });
        updatedLots = res.count;
      }

      results.push({
        manifestItemId: item.id,
        productName: item.productName,
        fobGhsUnitCents,
        allocatedFreightUnitCents,
        allocatedDutyUnitCents,
        frozenLandedUnitCostCents,
        updatedLots,
      });
    }

    await this.audit.record({
      actorId: staffId,
      action: 'SHIPMENT_LANDED_COSTS_FROZEN',
      entityType: 'Shipment',
      entityId: shipmentId,
      after: { fxRateToGhs: fx, volumeExpensesCents, valueExpensesCents, itemCount: results.length },
    });

    return {
      shipmentId,
      reference: shipment.reference,
      fxRateToGhs: fx,
      volumeExpensesCents,
      valueExpensesCents,
      items: results,
    };
  }

  // =========================================================================
  // PHASE 7: WAREHOUSE BIN LOCATION & ABC CLASS ASSIGNMENT
  // =========================================================================

  async updateLotLocation(
    lotId: string,
    staffId: string,
    dto: { binLocation?: string; abcClass?: string },
  ) {
    const existing = await this.prisma.stockLot.findUnique({ where: { id: lotId } });
    if (!existing) throw new NotFoundException(`StockLot ${lotId} not found`);

    const abc = dto.abcClass?.toUpperCase();
    if (abc && !['A', 'B', 'C'].includes(abc)) {
      throw new BadRequestException('abcClass must be A, B, or C');
    }

    const updated = await this.prisma.stockLot.update({
      where: { id: lotId },
      data: {
        ...(dto.binLocation !== undefined
          ? { binLocation: dto.binLocation.trim().toUpperCase() || null }
          : {}),
        ...(abc ? { abcClass: abc } : {}),
      },
    });

    await this.audit.record({
      actorId: staffId,
      action: 'STOCK_LOT_LOCATION_UPDATED',
      entityType: 'StockLot',
      entityId: lotId,
      before: { binLocation: existing.binLocation, abcClass: existing.abcClass },
      after: { binLocation: updated.binLocation, abcClass: updated.abcClass },
    });
    return updated;
  }
}
