import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { nextDocumentNumber } from '../../common/utils/document-number';
import { PaginationDto, paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaxService } from '../tax/tax.service';
import { WalkInOrderDto } from './dto/walk-in-order.dto';

@Injectable()
export class OrdersService {
  private readonly listCache = new Map<string, { expiresAt: number; data: unknown }>();
  private static readonly LIST_CACHE_TTL_MS = 15_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly tax: TaxService,
  ) {}

  private invalidateListCache() {
    this.listCache.clear();
  }

  async findAll(query: PaginationDto) {
    const { skip, take } = paginationParams(query);
    const cacheKey = `${skip}:${take}`;
    const cached = this.listCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const data = await this.prisma.salesOrder.findMany({
      skip,
      take,
      select: {
        id: true,
        reference: true,
        customerId: true,
        source: true,
        status: true,
        orderStatus: true,
        paymentStatus: true,
        fulfilmentStatus: true,
        totalCents: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        lines: {
          select: {
            id: true,
            variantId: true,
            quantity: true,
            unitPriceCents: true,
            variant: {
              select: {
                id: true,
                sku: true,
                name: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amountCents: true,
            method: true,
            status: true,
            reference: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    this.listCache.set(cacheKey, {
      expiresAt: Date.now() + OrdersService.LIST_CACHE_TTL_MS,
      data,
    });
    return data;
  }

  async findById(id: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { variant: { include: { product: true } }, collections: true } },
        payments: { include: { refunds: true } },
        customer: { include: { user: true } },
        returns: true,
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    this.invalidateListCache();
    return order;
  }

  async findByCustomer(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    return this.prisma.salesOrder.findMany({
      where: { customerId: profile.id },
      include: {
        lines: { include: { variant: { include: { product: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCheckout(
    userId: string,
    dto: {
      items: Array<{ variantId: string; quantity: number }>;
      disclosedDefectsAcknowledged?: boolean;
      notes?: string;
    },
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Checkout requires at least one item');
    }

    const profile =
      (await this.prisma.customerProfile.findUnique({ where: { userId } })) ??
      (await this.prisma.customerProfile.create({ data: { userId } }));

    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let totalCents = 0;
    let hasDisclosedDefects = false;
    const orderLines: Array<{ variantId: string; quantity: number; unitPriceCents: number }> = [];

    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException('Checkout item quantity must be a positive integer');
      }
      const v = variantMap.get(item.variantId);
      if (!v) throw new NotFoundException(`Variant ${item.variantId} not found`);
      if (!v.product.isPublished) {
        throw new BadRequestException(`Product "${v.product.name}" is not currently published for sale`);
      }
      if (v.product.defectDisclosures) hasDisclosedDefects = true;
      totalCents += v.priceCents * item.quantity;
      orderLines.push({ variantId: v.id, quantity: item.quantity, unitPriceCents: v.priceCents });
    }

    if (hasDisclosedDefects && !dto.disclosedDefectsAcknowledged) {
      throw new BadRequestException('You must acknowledge disclosed product defects before checkout');
    }

    const holdSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'CHECKOUT_HOLD_MINUTES' },
    });
    const holdMinutes = holdSetting && Number(holdSetting.value) > 0 ? Number(holdSetting.value) : 15;
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

    const { order, session } = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const reference = await nextDocumentNumber(tx, `ORD_${year}`, `AH-ORD-${year}`);
      const createdOrder = await tx.salesOrder.create({
        data: {
          reference,
          customerId: profile.id,
          source: 'ONLINE',
          status: 'PLACED',
          orderStatus: 'PLACED',
          paymentStatus: 'PENDING',
          fulfilmentStatus: 'NOT_STARTED',
          disclosedDefectsAcknowledged: Boolean(dto.disclosedDefectsAcknowledged),
          totalCents,
          notes: dto.notes,
          lines: { create: orderLines },
        },
        include: { lines: true },
      });

      let lastHoldId: string | undefined;
      for (const line of createdOrder.lines) {
        const hold = await this.inventory.commitStock(
          {
            variantId: line.variantId,
            quantity: line.quantity,
            reason: 'CHECKOUT_HOLD',
            referenceType: 'CHECKOUT_ORDER',
            referenceId: createdOrder.id,
          },
          userId,
          tx,
        );
        lastHoldId = hold.id;
      }

      const createdSession = await tx.checkoutSession.create({
        data: {
          customerId: profile.id,
          orderId: createdOrder.id,
          holdId: lastHoldId,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      return { order: createdOrder, session: createdSession };
    });

    await this.notifications.notifyCustomerByProfileId(
      profile.id,
      'Order placed',
      `Your order ${order.reference ?? order.id} has been placed and is awaiting payment verification.`,
      'ORDERS',
    );
    await this.notifications.notifyActiveStaff(
      'New customer order',
      `Customer placed order ${order.reference ?? order.id}.`,
      'ORDERS',
    );

    this.invalidateListCache();
    return { order, checkoutSession: session };
  }

  async createWalkIn(staffId: string, dto: WalkInOrderDto) {
    let customerProfileId: string | undefined;
    if (dto.customerId) {
      const profile = await this.prisma.customerProfile.findFirst({
        where: { OR: [{ id: dto.customerId }, { userId: dto.customerId }] },
      });
      if (!profile) throw new NotFoundException(`Customer ${dto.customerId} not found`);
      customerProfileId = profile.id;
    }

    const walkInHoldSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'WALK_IN_UNPAID_HOLD_HOURS' },
    });
    const walkInHoldHours =
      walkInHoldSetting && Number(walkInHoldSetting.value) > 0
        ? Number(walkInHoldSetting.value)
        : 24;
    const walkInExpiresAt = new Date(Date.now() + walkInHoldHours * 60 * 60 * 1000);

    const totalCents = dto.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPriceCents,
      0,
    );
    const order = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const reference = await nextDocumentNumber(tx, `ORD_${year}`, `AH-ORD-${year}`);
      const created = await tx.salesOrder.create({
        data: {
          reference,
          customerId: customerProfileId,
          source: 'WALK_IN',
          status: 'CONFIRMED',
          orderStatus: 'CONFIRMED',
          paymentStatus: 'PENDING',
          fulfilmentStatus: 'NOT_STARTED',
          totalCents,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
      let lastHoldId: string | undefined;
      for (const line of created.lines) {
        const hold = await this.inventory.commitStock(
          {
            variantId: line.variantId,
            quantity: line.quantity,
            reason: 'SALES_ORDER',
            referenceType: 'ORDER',
            referenceId: created.id,
          },
          staffId,
          tx,
        );
        lastHoldId = hold.id;
      }
      // Time-bound hold so unpaid walk-in orders expire if no deposit is verified in time
      await tx.checkoutSession.create({
        data: {
          customerId: customerProfileId,
          orderId: created.id,
          holdId: lastHoldId,
          status: 'ACTIVE',
          expiresAt: walkInExpiresAt,
        },
      });
      return created;
    });
    await this.audit.record({
      actorId: staffId,
      action: 'ORDER_CREATED',
      entityType: 'SalesOrder',
      entityId: order.id,
      after: { totalCents, lines: order.lines.length },
    });
    this.invalidateListCache();
    return order;
  }

  async cancelOrder(
    id: string,
    staffId: string,
    reason: string,
    opts?: { refundMethod?: 'ORIGINAL' | 'STORE_CREDIT'; restockingFeeBps?: number },
  ) {
    const existing = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!existing) throw new NotFoundException(`Order ${id} not found`);
    if (existing.orderStatus === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }
    if (['PARTIALLY_COLLECTED', 'COLLECTED'].includes(existing.fulfilmentStatus)) {
      throw new BadRequestException(
        'Collected orders cannot be cancelled; submit a return request instead',
      );
    }

    // Atomically claim the cancellation transition so two concurrent cancel requests
    // can never double-release holds, double-refund, or issue duplicate credit notes.
    const claimed = await this.prisma.salesOrder.updateMany({
      where: {
        id,
        orderStatus: { not: 'CANCELLED' },
        fulfilmentStatus: { notIn: ['PARTIALLY_COLLECTED', 'COLLECTED'] },
      },
      data: {
        status: 'CANCELLED',
        orderStatus: 'CANCELLED',
        notes: reason,
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Order is already cancelled or collected');
    }

    const holds = await this.prisma.stockHold.findMany({
      where: {
        referenceType: { in: ['ORDER', 'CHECKOUT_ORDER', 'SALES_ORDER'] },
        referenceId: id,
        status: 'ACTIVE',
      },
    });
    for (const hold of holds) {
      await this.inventory.releaseHold(hold.id, staffId);
    }

    await this.prisma.checkoutSession.updateMany({
      where: { orderId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    const verifiedPayments = existing.payments.filter((p) => p.status === 'VERIFIED');
    const verifiedTotalCents = verifiedPayments.reduce((s, p) => s + p.amountCents, 0);
    const feeBps = Math.max(0, Math.min(5000, Math.round(opts?.restockingFeeBps ?? 0)));
    const restockingFeeCents = Math.round((verifiedTotalCents * feeBps) / 10_000);
    const refundableCents = Math.max(0, verifiedTotalCents - restockingFeeCents);

    let settlementSummary: {
      verifiedTotalCents: number;
      restockingFeeCents: number;
      refundableCents: number;
      mode: 'NONE' | 'STORE_CREDIT' | 'REFUND_QUEUED';
    } = {
      verifiedTotalCents,
      restockingFeeCents,
      refundableCents,
      mode: 'NONE',
    };

    if (refundableCents > 0) {
      if (opts?.refundMethod === 'STORE_CREDIT' && existing.customerId) {
        await this.prisma.storeCreditEntry.create({
          data: {
            customerId: existing.customerId,
            amountCents: refundableCents,
            remainingCents: refundableCents,
            status: 'ACTIVE',
            issuedBy: staffId,
            notes: `Cancelled order ${existing.reference}: ${reason}`,
          },
        });
        settlementSummary.mode = 'STORE_CREDIT';
      } else {
        // Queue approved refund(s) against verified payment(s) so finance processes via original channel
        let left = refundableCents;
        for (const p of verifiedPayments) {
          if (left <= 0) break;
          const chunk = Math.min(p.amountCents, left);
          await this.prisma.refund.create({
            data: {
              paymentId: p.id,
              amountCents: chunk,
              reason: `Order ${existing.reference} cancelled: ${reason}`,
              status: 'APPROVED',
            },
          });
          left -= chunk;
        }
        settlementSummary.mode = 'REFUND_QUEUED';
      }

      // Issue a GRA E-VAT credit note if a tax invoice had already been issued for this order
      await this.tax
        .issueCreditNote(id, refundableCents, `Order cancelled: ${reason}`, staffId)
        .catch(() => null);
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        orderStatus: 'CANCELLED',
        ...(refundableCents > 0
          ? {
              paymentStatus:
                refundableCents >= verifiedTotalCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            }
          : {}),
        notes: reason,
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'ORDER_CANCELLED',
      entityType: 'SalesOrder',
      entityId: id,
      before: { orderStatus: existing.orderStatus, paymentStatus: existing.paymentStatus },
      after: { orderStatus: 'CANCELLED', reason, settlement: settlementSummary },
    });
    await this.notifications.notifyCustomerByProfileId(
      existing.customerId,
      'Order cancelled',
      refundableCents > 0
        ? `Your order ${existing.reference} has been cancelled (${reason}). Refund of GHS ${(refundableCents / 100).toLocaleString()} has been initiated${settlementSummary.mode === 'STORE_CREDIT' ? ' as store credit' : ''}.`
        : `Your order ${existing.reference} has been cancelled (${reason}).`,
      'ORDERS',
    );

    this.invalidateListCache();
    return { ...updated, settlement: settlementSummary };
  }
}
