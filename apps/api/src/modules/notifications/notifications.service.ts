import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

const STAFF_NOTIFICATION_PERMISSIONS: Record<string, string[]> = {
  ORDERS: ['orders.view', 'orders.approve'],
  RESERVATIONS: ['reservations.view', 'reservations.approve'],
  REQUESTS: ['product_requests.view', 'product_requests.review'],
  STAFF_REPORTS: ['staff_reports.view', 'staff_reports.manage'],
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomerProfileId(userId: string): Promise<string> {
    const existing = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (existing) return existing.id;
    const created = await this.prisma.customerProfile.create({ data: { userId } });
    return created.id;
  }

  sendInApp(userId: string, dto: CreateNotificationDto) {
    return this.prisma.notificationMessage.create({ data: { userId, ...dto } });
  }

  async notifyCustomerByProfileId(
    customerProfileId: string | null | undefined,
    title: string,
    body: string,
    type = 'ORDERS',
  ) {
    if (!customerProfileId) return;
    try {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { id: customerProfileId },
        select: { userId: true },
      });
      if (!profile) return;
      await this.prisma.notificationMessage.create({
        data: { userId: profile.userId, title, body, type },
      });
    } catch {
      // Non-fatal notification failure
    }
  }

  async notifyActiveStaff(
    title: string,
    body: string,
    type = 'OPERATIONS',
    requiredPermissions?: string[],
  ) {
    try {
      const effectivePerms = requiredPermissions ?? STAFF_NOTIFICATION_PERMISSIONS[type];
      const staff = await this.prisma.staffProfile.findMany({
        where: { isActive: true },
        select: {
          userId: true,
          isOwner: true,
          groupAssignments: {
            select: {
              group: {
                select: {
                  permissions: {
                    select: { permission: { select: { code: true } } },
                  },
                },
              },
            },
          },
        },
      });
      const allowedRecipients = staff.filter((s) => {
        if (s.isOwner) return true;
        if (!effectivePerms || effectivePerms.length === 0) return true;
        const codes = new Set(
          s.groupAssignments.flatMap((a) =>
            a.group.permissions.map((gp) => gp.permission.code),
          ),
        );
        return effectivePerms.some((perm) => codes.has(perm));
      });
      if (allowedRecipients.length === 0) return;
      await this.prisma.notificationMessage.createMany({
        data: allowedRecipients.map((s) => ({
          userId: s.userId,
          title,
          body,
          type,
        })),
      });
    } catch {
      // Non-fatal notification failure
    }
  }

  queueWhatsApp(phone: string, template: string, params: Record<string, string>) {
    return this.prisma.outboxEvent.create({
      data: {
        eventType: 'whatsapp.template',
        payload: { phone, template, params },
      },
    });
  }

  async getMyNotifications(userId: string, query: PaginationDto) {
    const rows = await this.prisma.notificationMessage.findMany({
      ...paginationParams(query),
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      select: {
        isOwner: true,
        isActive: true,
        groupAssignments: {
          select: {
            group: {
              select: {
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });

    if (!staff || staff.isOwner) return rows;
    const codes = new Set(
      staff.groupAssignments.flatMap((a) =>
        a.group.permissions.map((gp) => gp.permission.code),
      ),
    );
    return rows.filter((n) => {
      const req = STAFF_NOTIFICATION_PERMISSIONS[n.type];
      if (!req) return true;
      return req.some((perm) => codes.has(perm));
    });
  }

  async markRead(id: string, userId?: string) {
    const existing = await this.prisma.notificationMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Notification ${id} not found`);
    if (userId && existing.userId !== userId) {
      throw new ForbiddenException('You can only mark your own notifications as read');
    }
    return this.prisma.notificationMessage.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async getPreferences(userId: string) {
    const customerId = await this.resolveCustomerProfileId(userId);
    const pref = await this.prisma.notificationPreference.upsert({
      where: { customerId },
      update: {},
      create: { customerId },
    });
    const profile = await this.prisma.customerProfile.findUnique({ where: { id: customerId } });
    return { ...pref, whatsappConsent: profile?.whatsappConsent ?? false };
  }

  async updatePreferences(
    userId: string,
    dto: Partial<{
      productRequests: boolean;
      reservations: boolean;
      ordersPayments: boolean;
      availability: boolean;
      promotions: boolean;
    }>,
  ) {
    const customerId = await this.resolveCustomerProfileId(userId);
    const data: Record<string, boolean> = {};
    if (typeof dto.productRequests === 'boolean') data.productRequests = dto.productRequests;
    if (typeof dto.reservations === 'boolean') data.reservations = dto.reservations;
    if (typeof dto.ordersPayments === 'boolean') data.ordersPayments = dto.ordersPayments;
    if (typeof dto.availability === 'boolean') data.availability = dto.availability;
    if (typeof dto.promotions === 'boolean') data.promotions = dto.promotions;
    return this.prisma.notificationPreference.upsert({
      where: { customerId },
      update: data,
      create: { customerId, ...data },
    });
  }

  async recordWhatsAppConsent(userId: string, granted: boolean, source = 'CUSTOMER_PORTAL') {
    const customerId = await this.resolveCustomerProfileId(userId);
    await this.prisma.customerProfile.update({
      where: { id: customerId },
      data: { whatsappConsent: granted },
    });
    return this.prisma.consentEvent.create({
      data: {
        customerId,
        channel: 'WHATSAPP',
        status: granted ? 'GRANTED' : 'WITHDRAWN',
        source,
      },
    });
  }

  async getDigitalReceipt(orderId: string, actor?: { id: string; role?: string }) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { OR: [{ id: orderId }, { reference: orderId }] },
      include: {
        lines: { include: { variant: { include: { product: true } } } },
        payments: true,
        customer: { include: { user: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (actor && actor.role !== 'STAFF' && order.customer?.userId !== actor.id) {
      throw new ForbiddenException('You are not authorised to view this digital receipt');
    }

    const verifiedPayments = order.payments.filter((p) => p.status === 'VERIFIED');
    const amountPaidCents = verifiedPayments.reduce((s, p) => s + p.amountCents, 0);
    const outstandingBalanceCents = Math.max(0, order.totalCents - amountPaidCents);

    return {
      businessName: 'AmericanHomes',
      orderId: order.id,
      reference: order.reference,
      issuedAt: new Date().toISOString(),
      customer: order.customer?.user
        ? { name: order.customer.user.name, phone: order.customer.user.phone }
        : { name: 'Walk-in Customer' },
      items: order.lines.map((l) => ({
        productName: l.variant.product.name,
        variant: l.variant.name ?? l.variant.sku,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        discountCents: l.discountCents,
      })),
      totalCents: order.totalCents,
      amountPaidCents,
      outstandingBalanceCents,
      isPartialPayment: outstandingBalanceCents > 0,
      paymentMethods: Array.from(new Set(verifiedPayments.map((p) => p.method))),
    };
  }
}
