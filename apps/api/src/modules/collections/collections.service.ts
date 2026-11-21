import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordCollectionDto } from './dto/record-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll() {
    const records = await this.prisma.collectionRecord.findMany({
      include: { lines: { include: { orderLine: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const orderIds = Array.from(
      new Set(records.map((r) => r.orderId).filter((id): id is string => Boolean(id))),
    );
    const orders = orderIds.length
      ? await this.prisma.salesOrder.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            reference: true,
            source: true,
            fulfilmentStatus: true,
            customer: { select: { user: { select: { name: true, phone: true } } } },
          },
        })
      : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return records.map((r) => ({
      ...r,
      order: r.orderId ? (orderMap.get(r.orderId) ?? null) : null,
    }));
  }

  findEligibleOrders() {
    return this.prisma.salesOrder.findMany({
      where: {
        orderStatus: { not: 'CANCELLED' },
        fulfilmentStatus: { not: 'COLLECTED' },
      },
      select: {
        id: true,
        reference: true,
        source: true,
        totalCents: true,
        paymentStatus: true,
        fulfilmentStatus: true,
        createdAt: true,
        customer: { select: { user: { select: { name: true, phone: true } } } },
        lines: {
          select: {
            quantity: true,
            variant: { select: { product: { select: { name: true } } } },
          },
        },
        payments: {
          where: { status: 'VERIFIED' },
          select: { amountCents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async recordCollection(staffId: string, dto: RecordCollectionDto, isOwner = false) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { OR: [{ id: dto.orderId }, { reference: dto.orderId }] },
      include: { lines: { include: { collections: true } } },
    });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    if (order.paymentStatus !== 'PAID' && !dto.unpaidExceptionApprovedBy && !isOwner) {
      throw new ForbiddenException(
        'Order has an unpaid balance; management or Owner authorization is required for collection.',
      );
    }

    const unpaidApprover =
      order.paymentStatus !== 'PAID'
        ? (dto.unpaidExceptionApprovedBy ?? (isOwner ? staffId : undefined))
        : undefined;

    if (dto.representativeName && !dto.representativeOtpVerified && !dto.approvedBy) {
      throw new BadRequestException(
        'Authorised representative collection requires customer-phone OTP verification or management approval.',
      );
    }

    const lineInputs =
      dto.lines && dto.lines.length > 0
        ? dto.lines
        : order.lines
            .map((l) => {
              const collected = l.collections.reduce((s, c) => s + c.quantity, 0);
              return { orderLineId: l.id, quantity: Math.max(0, l.quantity - collected) };
            })
            .filter((l) => l.quantity > 0);

    if (lineInputs.length === 0) {
      throw new BadRequestException('No remaining uncollected items for this order');
    }

    const collection = await this.prisma.collectionRecord.create({
      data: {
        orderId: order.id,
        collectedBy: staffId,
        representativeName: dto.representativeName,
        representativePhone: dto.representativePhone,
        representativeOtpVerified: Boolean(dto.representativeOtpVerified),
        approvedBy: dto.approvedBy,
        unpaidExceptionApprovedBy: unpaidApprover,
        status: 'COMPLETED',
        collectedAt: new Date(),
        notes: dto.notes,
        lines: { create: lineInputs },
      },
      include: { lines: true },
    });

    // Determine whether order is partially or fully collected
    const refreshed = await this.prisma.salesOrder.findUnique({
      where: { id: order.id },
      include: { lines: { include: { collections: true } } },
    });
    const allCollected =
      refreshed?.lines.every(
        (l) => l.collections.reduce((s, c) => s + c.quantity, 0) >= l.quantity,
      ) ?? false;

    const fulfilmentStatus = allCollected ? 'COLLECTED' : 'PARTIALLY_COLLECTED';
    await this.prisma.salesOrder.update({
      where: { id: order.id },
      data: { fulfilmentStatus, ...(allCollected ? { status: 'COLLECTED' } : {}) },
    });

    await this.audit.record({
      actorId: staffId,
      approverId: unpaidApprover ?? dto.approvedBy,
      action: 'COLLECTION_RECORDED',
      entityType: 'CollectionRecord',
      entityId: collection.id,
      after: { orderId: order.id, fulfilmentStatus, lines: lineInputs.length },
    });

    await this.notifications.notifyCustomerByProfileId(
      order.customerId,
      allCollected ? 'Order collected' : 'Partial collection recorded',
      allCollected
        ? `Your order ${order.reference ?? order.id} has been collected.`
        : `A partial collection was recorded for order ${order.reference ?? order.id}.`,
      'ORDERS',
    );

    return { ...collection, fulfilmentStatus };
  }
}
