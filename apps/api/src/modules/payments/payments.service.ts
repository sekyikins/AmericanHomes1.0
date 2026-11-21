import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaystackService } from '../../integrations/paystack/paystack.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { ManualPaymentDto } from './dto/manual-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
  ) {}

  async listAll() {
    return this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: { include: { customer: { include: { user: true } } } },
        attempts: true,
      },
    });
  }

  async initializePayment(dto: InitializePaymentDto, userId?: string) {
    const order = await this.prisma.salesOrder.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException(`SalesOrder ${dto.orderId} not found`);

    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : null;
    const customerEmail = user?.email ?? 'customer@americanhomes.gh';

    const initResult = await this.paystack.initializeTransaction(
      customerEmail,
      dto.amountCents,
      { orderId: dto.orderId, channel: dto.channel },
    );

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        amountCents: dto.amountCents,
        method: dto.channel === 'paystack_card' ? 'PAYSTACK_CARD' : 'PAYSTACK_MOBILE_MONEY',
        status: 'PENDING',
        reference: initResult.reference,
        recordedBy: userId,
      },
    });
    await this.prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        amountCents: dto.amountCents,
        status: 'INITIATED',
        providerRef: initResult.reference,
      },
    });

    return { ...initResult, paymentId: payment.id };
  }

  async verifyPayment(reference: string) {
    const verification = await this.paystack.verifyTransaction(reference);
    if (verification.status === 'success') {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { reference },
      });
      if (existingPayment) {
        const settlement = await this.settleVerifiedPayment(existingPayment, reference);
        return { ...verification, ...settlement };
      }
    }
    return verification;
  }

  getExceptions() {
    return this.prisma.payment.findMany({
      where: { OR: [{ isException: true }, { status: 'EXCEPTION' }] },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordManualPayment(dto: ManualPaymentDto, staffId?: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: dto.orderId },
      include: { payments: true },
    });
    if (!order) {
      throw new NotFoundException(`SalesOrder ${dto.orderId} not found`);
    }
    const verifiedPaidCents = order.payments
      .filter((p) => p.status === 'VERIFIED')
      .reduce((s, p) => s + p.amountCents, 0);
    const remainingCents = Math.max(0, order.totalCents - verifiedPaidCents);
    if (remainingCents <= 0) {
      throw new BadRequestException(
        `Order ${order.reference} is already paid in full (GHS ${(order.totalCents / 100).toLocaleString()}).`,
      );
    }
    if (dto.amountCents > remainingCents) {
      throw new BadRequestException(
        `Payment of GHS ${(dto.amountCents / 100).toLocaleString()} exceeds remaining balance of GHS ${(remainingCents / 100).toLocaleString()} (original total: GHS ${(order.totalCents / 100).toLocaleString()}).`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        amountCents: dto.amountCents,
        method: dto.method,
        reference: dto.reference,
        payerName: dto.payerName,
        payerPhone: dto.payerPhone,
        evidenceUrl: dto.evidenceUrl,
        recordedBy: staffId,
        status: 'PENDING',
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'MANUAL_PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment.id,
      after: {
        orderId: dto.orderId,
        amountCents: dto.amountCents,
        method: dto.method,
        payerName: dto.payerName,
        payerPhone: dto.payerPhone,
        evidenceUrl: dto.evidenceUrl,
        status: 'PENDING',
      },
    });
    return payment;
  }

  private async syncOrderPaymentStatus(orderId: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) return;
    const verifiedSum = order.payments
      .filter((p) => p.status === 'VERIFIED')
      .reduce((s, p) => s + p.amountCents, 0);
    const paymentStatus =
      verifiedSum >= order.totalCents
        ? 'PAID'
        : verifiedSum > 0
          ? 'PARTIALLY_PAID'
          : 'PENDING';
    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        ...(paymentStatus === 'PAID' && order.orderStatus === 'PLACED'
          ? { orderStatus: 'CONFIRMED', status: 'CONFIRMED' }
          : {}),
      },
    });
  }

  async approveManualPayment(paymentId: string, staffId: string, isOwner = false) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    if (!isOwner && payment.recordedBy && payment.recordedBy === staffId) {
      throw new ForbiddenException(
        'Self-approval is prohibited: another authorised user must approve this payment.',
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'VERIFIED', approvedBy: staffId, verifiedAt: new Date() },
    });
    await this.syncOrderPaymentStatus(payment.orderId);
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'MANUAL_PAYMENT_APPROVED',
      entityType: 'Payment',
      entityId: paymentId,
      before: { status: payment.status },
      after: { status: 'VERIFIED' },
    });
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: payment.orderId },
      select: { customerId: true, reference: true },
    });
    await this.notifications.notifyCustomerByProfileId(
      order?.customerId,
      'Payment verified',
      `Your payment for order ${order?.reference ?? payment.orderId} has been verified.`,
      'ORDERS',
    );
    return updated;
  }

  async reversePayment(paymentId: string, staffId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });
    await this.prisma.refund.create({
      data: {
        paymentId,
        amountCents: payment.amountCents,
        reason,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
    await this.syncOrderPaymentStatus(payment.orderId);
    await this.audit.record({
      actorId: staffId,
      action: 'PAYMENT_REVERSED',
      entityType: 'Payment',
      entityId: paymentId,
      before: { status: payment.status },
      after: { status: 'REFUNDED', reason },
    });
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: payment.orderId },
      select: { customerId: true, reference: true },
    });
    await this.notifications.notifyCustomerByProfileId(
      order?.customerId,
      'Payment refunded',
      `A payment for order ${order?.reference ?? payment.orderId} was reversed (${reason}).`,
      'ORDERS',
    );
    return updated;
  }

  async handleWebhook(payload: unknown, signature: string) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    if (!this.paystack.verifyWebhookSignature(raw, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    const event = payload as { event?: string; data?: { reference?: string } };
    const reference = event?.data?.reference;
    if (!reference) {
      return { ok: true, ignored: true };
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { reference },
    });
    if (!existingPayment) {
      return { ok: true, reference, unknownPayment: true };
    }
    if (existingPayment.status === 'VERIFIED') {
      return { ok: true, idempotent: true, reference };
    }

    if (event.event === 'charge.success') {
      const result = await this.settleVerifiedPayment(existingPayment, reference);
      return { ok: true, ...result };
    }

    return { ok: true, reference };
  }

  private async settleVerifiedPayment(
    existingPayment: { id: string; orderId: string; status: string },
    reference: string,
  ) {
    if (existingPayment.status === 'VERIFIED') {
      return { idempotent: true, settled: true, reference };
    }

    // Check if checkout hold already expired (§4.2.5-7)
    const expiredSession = await this.prisma.checkoutSession.findFirst({
      where: { orderId: existingPayment.orderId, status: 'EXPIRED' },
    });
    if (expiredSession) {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: 'EXCEPTION',
          isException: true,
          exceptionReason:
            'Late payment received after checkout hold expired; requires management review',
        },
      });
      await this.audit.record({
        action: 'PAYMENT_LATE_EXCEPTION',
        entityType: 'Payment',
        entityId: existingPayment.id,
        after: { orderId: existingPayment.orderId, reference },
      });
      return { exception: true, settled: false, reference };
    }

    await this.prisma.payment.update({
      where: { id: existingPayment.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
    const holds = await this.prisma.stockHold.findMany({
      where: {
        referenceType: { in: ['CHECKOUT_ORDER', 'ORDER'] },
        referenceId: existingPayment.orderId,
        status: 'ACTIVE',
      },
    });
    for (const h of holds) {
      await this.inventory.consumeHold(h.id);
    }
    await this.prisma.checkoutSession.updateMany({
      where: { orderId: existingPayment.orderId, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    await this.syncOrderPaymentStatus(existingPayment.orderId);
    return { settled: true, reference };
  }
}
