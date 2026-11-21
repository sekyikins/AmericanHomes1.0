import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WalkInOrderDto } from './dto/walk-in-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(query: PaginationDto) {
    return this.prisma.salesOrder.findMany({
      ...paginationParams(query),
      include: {
        customer: { include: { user: true } },
        lines: { include: { variant: { include: { product: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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

    const order = await this.prisma.salesOrder.create({
      data: {
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
    for (const line of order.lines) {
      const hold = await this.inventory.commitStock(
        {
          variantId: line.variantId,
          quantity: line.quantity,
          reason: 'CHECKOUT_HOLD',
          referenceType: 'CHECKOUT_ORDER',
          referenceId: order.id,
        },
        userId,
      );
      lastHoldId = hold.id;
    }

    const session = await this.prisma.checkoutSession.create({
      data: {
        customerId: profile.id,
        orderId: order.id,
        holdId: lastHoldId,
        status: 'ACTIVE',
        expiresAt,
      },
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

    const totalCents = dto.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPriceCents,
      0,
    );
    const order = await this.prisma.salesOrder.create({
      data: {
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
    for (const line of order.lines) {
      await this.inventory.commitStock(
        {
          variantId: line.variantId,
          quantity: line.quantity,
          reason: 'SALES_ORDER',
          referenceType: 'ORDER',
          referenceId: order.id,
        },
        staffId,
      );
    }
    await this.audit.record({
      actorId: staffId,
      action: 'ORDER_CREATED',
      entityType: 'SalesOrder',
      entityId: order.id,
      after: { totalCents, lines: order.lines.length },
    });
    return order;
  }

  async cancelOrder(id: string, staffId: string, reason: string) {
    const existing = await this.prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order ${id} not found`);

    const holds = await this.prisma.stockHold.findMany({
      where: {
        referenceType: { in: ['ORDER', 'CHECKOUT_ORDER'] },
        referenceId: id,
        status: 'ACTIVE',
      },
    });
    for (const hold of holds) {
      await this.inventory.releaseHold(hold.id, staffId);
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED', orderStatus: 'CANCELLED', notes: reason },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'ORDER_CANCELLED',
      entityType: 'SalesOrder',
      entityId: id,
      before: { orderStatus: existing.orderStatus },
      after: { orderStatus: 'CANCELLED', reason },
    });
    await this.notifications.notifyCustomerByProfileId(
      existing.customerId,
      'Order cancelled',
      `Your order ${existing.reference ?? existing.id} has been cancelled (${reason}).`,
      'ORDERS',
    );

    return updated;
  }
}
