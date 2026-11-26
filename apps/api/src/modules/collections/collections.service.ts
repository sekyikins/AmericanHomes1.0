import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordCollectionDto } from './dto/record-collection.dto';

const MAX_RELEASE_PIN_ATTEMPTS = 5;

function hashReleasePin(pin: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
  ) {}

  private releasePinKey(orderId: string) {
    return `COLLECTION_PIN:${orderId}`;
  }

  async sendReleasePin(orderId: string, staffId?: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { OR: [{ id: orderId }, { reference: orderId }] },
      include: { customer: { include: { user: true } } },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const pin = String(randomInt(100000, 1000000));
    const salt = randomBytes(16).toString('hex');
    const pinHash = hashReleasePin(pin, salt);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await this.prisma.systemSetting.upsert({
      where: { key: this.releasePinKey(order.id) },
      update: {
        value: JSON.stringify({ pinHash, salt, expiresAt, attempts: 0, consumed: false, generatedBy: staffId }),
        updatedBy: staffId,
      },
      create: {
        key: this.releasePinKey(order.id),
        value: JSON.stringify({ pinHash, salt, expiresAt, attempts: 0, consumed: false, generatedBy: staffId }),
        description: `Hashed collection release PIN for order ${order.reference}`,
        updatedBy: staffId,
      },
    });

    const msg = `Your 6-digit release PIN for order ${order.reference ?? order.id} is ${pin}. Share this PIN only with your authorized representative or dispatch driver at the warehouse gate.`;
    await this.notifications.notifyCustomerByProfileId(
      order.customerId,
      'Warehouse Collection Release PIN',
      msg,
      'ORDERS',
    );
    // Also enqueue WhatsApp delivery via transactional outbox when the customer has a phone number
    const phone = order.customer?.user?.phone ?? '';
    if (phone) {
      await this.prisma.outboxEvent.create({
        data: {
          eventType: 'WHATSAPP_NOTIFICATION',
          payload: { to: phone, text: msg, orderId: order.id, kind: 'COLLECTION_RELEASE_PIN' },
          status: 'PENDING',
        },
      });
    }

    const maskedPhone =
      phone.length >= 6 ? `${phone.slice(0, 4)}****${phone.slice(-2)}` : 'Customer account';

    return {
      sent: true,
      orderId: order.id,
      orderReference: order.reference,
      maskedPhone,
      expiresAt,
    };
  }

  async verifyReleasePin(orderId: string, pin: string, consume = false) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { OR: [{ id: orderId }, { reference: orderId }] },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const key = this.releasePinKey(order.id);
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row?.value) {
      return { verified: false, reason: 'No release PIN has been generated for this order yet' };
    }
    try {
      const parsed = JSON.parse(row.value) as {
        pinHash?: string;
        salt?: string;
        expiresAt: string;
        attempts?: number;
        consumed?: boolean;
      };
      if (parsed.consumed) {
        return { verified: false, reason: 'Release PIN has already been used; send a new PIN' };
      }
      if (new Date(parsed.expiresAt).getTime() < Date.now()) {
        return { verified: false, reason: 'Release PIN has expired; please send a new PIN' };
      }
      const attempts = parsed.attempts ?? 0;
      if (attempts >= MAX_RELEASE_PIN_ATTEMPTS) {
        return { verified: false, reason: 'Too many failed PIN attempts; please send a new PIN' };
      }
      if (!parsed.pinHash || !parsed.salt) {
        return { verified: false, reason: 'Stored PIN is outdated; please send a new PIN' };
      }
      const candidate = Buffer.from(hashReleasePin(String(pin ?? '').trim(), parsed.salt), 'hex');
      const expected = Buffer.from(parsed.pinHash, 'hex');
      const ok = candidate.length === expected.length && timingSafeEqual(candidate, expected);
      if (!ok) {
        await this.prisma.systemSetting.update({
          where: { key },
          data: { value: JSON.stringify({ ...parsed, attempts: attempts + 1 }) },
        });
        return {
          verified: false,
          reason: `Invalid 6-digit release PIN (${MAX_RELEASE_PIN_ATTEMPTS - attempts - 1} attempt(s) left)`,
        };
      }
      if (consume) {
        await this.prisma.systemSetting.update({
          where: { key },
          data: { value: JSON.stringify({ ...parsed, consumed: true }) },
        });
      }
      return { verified: true, orderId: order.id };
    } catch {
      return { verified: false, reason: 'Invalid stored PIN state' };
    }
  }

  async findAll() {
    const records = await this.prisma.collectionRecord.findMany({
      include: {
        lines: {
          include: {
            orderLine: {
              include: {
                variant: {
                  include: {
                    product: { select: { id: true, name: true, category: true, condition: true } },
                  },
                },
              },
            },
          },
        },
      },
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
            paymentStatus: true,
            fulfilmentStatus: true,
            totalCents: true,
            customer: { select: { user: { select: { name: true, phone: true } } } },
          },
        })
      : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return records.map((r) => {
      const year = new Date(r.collectedAt ?? r.createdAt).getFullYear();
      const gatePassCode = `AH-GP-${year}-${r.id.slice(-6).toUpperCase()}`;
      return {
        ...r,
        gatePassCode,
        order: r.orderId ? (orderMap.get(r.orderId) ?? null) : null,
      };
    });
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

    let otpVerified = Boolean(dto.representativeOtpVerified);
    if (dto.releasePin) {
      const check = await this.verifyReleasePin(order.id, dto.releasePin, true);
      if (!check.verified) {
        throw new BadRequestException(check.reason ?? 'Invalid representative release PIN');
      }
      otpVerified = true;
    }

    if (dto.representativeName && !otpVerified && !dto.approvedBy) {
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

    const collectedAt = new Date();
    const collection = await this.prisma.collectionRecord.create({
      data: {
        orderId: order.id,
        collectedBy: staffId,
        fulfilmentMode: dto.fulfilmentMode || 'SELF_COLLECTION',
        deliveryAddress: dto.deliveryAddress?.trim() || undefined,
        vehiclePlate: dto.vehiclePlate?.trim().toUpperCase() || undefined,
        representativeName: dto.representativeName,
        representativePhone: dto.representativePhone,
        representativeOtpVerified: otpVerified,
        approvedBy: dto.approvedBy,
        unpaidExceptionApprovedBy: unpaidApprover,
        status: 'COMPLETED',
        collectedAt,
        notes: dto.notes?.trim() || undefined,
        lines: { create: lineInputs },
      },
      include: { lines: true },
    });

    // Consume collected quantities from the order's active StockHold & physical StockLot.quantity,
    // and bind any available TrackedUnits (serial numbers) to the OrderLine with warranty activation
    const orderLineById = new Map(order.lines.map((l) => [l.id, l]));
    for (const item of lineInputs) {
      const ol = orderLineById.get(item.orderLineId);
      if (ol && item.quantity > 0) {
        await this.inventory.consumeOrderQuantity(order.id, ol.variantId, item.quantity, staffId);
        const availableUnits = await this.prisma.trackedUnit.findMany({
          where: { variantId: ol.variantId, orderLineId: null, status: { in: ['AVAILABLE', 'HELD'] } },
          take: item.quantity,
          orderBy: { createdAt: 'asc' },
        });
        for (const u of availableUnits) {
          const warrantyExpiresAt = new Date(collectedAt);
          warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + (u.warrantyMonths || 12));
          await this.prisma.trackedUnit.update({
            where: { id: u.id },
            data: { orderLineId: ol.id, status: 'SOLD', warrantyExpiresAt },
          });
        }
      }
    }

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

    const gatePassCode = `AH-GP-${new Date().getFullYear()}-${collection.id.slice(-6).toUpperCase()}`;
    return { ...collection, gatePassCode, fulfilmentStatus };
  }
}
