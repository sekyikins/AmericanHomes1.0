import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(PaymentsService.name);

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

  async initializePayment(dto: InitializePaymentDto, userId?: string, userRole?: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: dto.orderId },
      include: { customer: true, payments: true },
    });
    if (!order) throw new NotFoundException(`SalesOrder ${dto.orderId} not found`);

    if (userRole !== 'STAFF' && order.customer?.userId !== userId) {
      throw new ForbiddenException('You are not authorized to initialize payment for this order');
    }
    if (order.orderStatus === 'CANCELLED') {
      throw new BadRequestException('Cannot initialize payment for a cancelled order');
    }

    const verifiedPaidCents = order.payments
      .filter((p) => p.status === 'VERIFIED')
      .reduce((s, p) => s + p.amountCents, 0);
    const remainingCents = Math.max(0, order.totalCents - verifiedPaidCents);
    if (remainingCents <= 0) {
      throw new BadRequestException('Order is already paid in full');
    }
    if (!Number.isInteger(dto.amountCents) || dto.amountCents <= 0) {
      throw new BadRequestException('Payment amount must be a positive integer');
    }
    if (userRole !== 'STAFF' && dto.amountCents !== remainingCents) {
      throw new BadRequestException(`Online payment must match remaining balance (${remainingCents} cents)`);
    }
    if (dto.amountCents > remainingCents) {
      throw new BadRequestException(`Payment amount exceeds remaining balance (${remainingCents} cents)`);
    }

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
        if (
          !verification.isStub &&
          (verification.amountPesewas < existingPayment.amountCents ||
            verification.currency.toUpperCase() !== 'GHS')
        ) {
          this.logger.warn(
            `[SECURITY] Paystack amount/currency mismatch ref=${reference} expected=${existingPayment.amountCents} got=${verification.amountPesewas} ${verification.currency}`,
          );
          throw new BadRequestException('Verified payment amount or currency does not match order');
        }
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

    if (
      (dto.method === 'MOBILE_MONEY' || dto.method === 'BANK_TRANSFER') &&
      !dto.reference?.trim()
    ) {
      throw new BadRequestException(
        dto.method === 'MOBILE_MONEY'
          ? 'Transaction ID is required for Mobile Money payments.'
          : 'Bank reference is required for Bank Transfer payments.',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        amountCents: dto.amountCents,
        method: dto.method,
        reference: dto.method === 'CASH' ? null : dto.reference?.trim() || undefined,
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
    let providerRefundStatus: string | undefined;
    if (payment.method.startsWith('PAYSTACK') && payment.reference) {
      try {
        const refundRes = await this.paystack.createRefund(payment.reference, payment.amountCents);
        providerRefundStatus = refundRes.status;
      } catch {
        providerRefundStatus = 'error';
      }
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
        status: providerRefundStatus === 'failed' ? 'FAILED' : 'PROCESSED',
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
      this.logger.warn('[SECURITY] Rejected Paystack webhook with invalid signature');
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    const event = payload as {
      event?: string;
      data?: { reference?: string; amount?: number; currency?: string };
    };
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
      if (
        typeof event.data?.amount === 'number' &&
        event.data.amount < existingPayment.amountCents
      ) {
        this.logger.warn(
          `[SECURITY] Paystack webhook underpayment ref=${reference} expected=${existingPayment.amountCents} got=${event.data.amount}`,
        );
        throw new BadRequestException('Webhook payment amount is less than expected');
      }
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
