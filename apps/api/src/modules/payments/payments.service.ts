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
import { TaxService } from '../tax/tax.service';
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
    private readonly tax: TaxService,
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
    if (dto.amountCents > remainingCents) {
      throw new BadRequestException(`Payment amount exceeds remaining balance (${remainingCents} cents)`);
    }
    // Enforce minimum deposit on the first installment of an order (default 30%, configurable via MIN_DEPOSIT_PERCENT)
    if (userRole !== 'STAFF' && verifiedPaidCents === 0 && dto.amountCents < remainingCents) {
      const minPctSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'MIN_DEPOSIT_PERCENT' },
      });
      const minPct =
        minPctSetting && Number(minPctSetting.value) > 0 && Number(minPctSetting.value) <= 100
          ? Number(minPctSetting.value)
          : 30;
      const minDepositCents = Math.min(remainingCents, Math.ceil((order.totalCents * minPct) / 100));
      if (dto.amountCents < minDepositCents) {
        throw new BadRequestException(
          `Initial partial payment must be at least ${minPct}% of order total (GHS ${(minDepositCents / 100).toLocaleString()})`,
        );
      }
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
    const existingPayment = await this.prisma.payment.findUnique({
      where: { reference },
    });

    if (verification.status === 'success') {
      if (existingPayment) {
        if (
          verification.amountPesewas < existingPayment.amountCents ||
          verification.currency.toUpperCase() !== 'GHS'
        ) {
          this.logger.warn(
            `[SECURITY] Paystack amount/currency mismatch ref=${reference} expected=${existingPayment.amountCents} got=${verification.amountPesewas} ${verification.currency}`,
          );
          throw new BadRequestException('Verified payment amount or currency does not match order');
        }
        const settlement = await this.settleVerifiedPayment(existingPayment, reference);
        return { ...verification, ...settlement };
      }
    } else if (
      existingPayment &&
      existingPayment.status === 'PENDING' &&
      ['failed', 'abandoned', 'reversed'].includes(String(verification.status).toLowerCase())
    ) {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: { status: 'FAILED' },
      });
      await this.prisma.paymentAttempt.create({
        data: {
          paymentId: existingPayment.id,
          amountCents: existingPayment.amountCents,
          status: String(verification.status).toUpperCase(),
          providerRef: reference,
        },
      });
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
    // Do NOT mark CheckoutSession COMPLETED on PENDING manual payment; only verified payments lock the hold.
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
    // Once paid in full, issue a gap-free sequential GRA E-VAT tax invoice (idempotent)
    if (paymentStatus === 'PAID') {
      await this.tax.issueForOrder(orderId).catch((err) => {
        this.logger.error(
          `Auto tax invoice issue failed for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
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
    await this.prisma.checkoutSession.updateMany({
      where: { orderId: payment.orderId, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
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
    await this.tax
      .issueCreditNote(payment.orderId, payment.amountCents, reason, staffId)
      .catch(() => null);
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

  async handleWebhook(payload: unknown, signature: string, rawBody?: Buffer) {
    const raw: Buffer | string =
      rawBody && rawBody.length > 0
        ? rawBody
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload ?? {});
    if (!this.paystack.verifyWebhookSignature(raw, signature)) {
      this.logger.warn('[SECURITY] Rejected Paystack webhook with invalid signature');
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    const event = payload as {
      event?: string;
      data?: { reference?: string; amount?: number; currency?: string; status?: string };
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
      const currency = String(event.data?.currency ?? 'GHS').toUpperCase();
      if (currency !== 'GHS') {
        this.logger.warn(
          `[SECURITY] Paystack webhook non-GHS currency ref=${reference} currency=${currency}`,
        );
        throw new BadRequestException('Webhook payment currency must be GHS');
      }
      if (
        typeof event.data?.amount !== 'number' ||
        event.data.amount < existingPayment.amountCents
      ) {
        this.logger.warn(
          `[SECURITY] Paystack webhook underpayment ref=${reference} expected=${existingPayment.amountCents} got=${event.data?.amount}`,
        );
        throw new BadRequestException('Webhook payment amount is less than expected');
      }
      const result = await this.settleVerifiedPayment(existingPayment, reference);
      return { ok: true, ...result };
    }

    if (event.event === 'charge.failed') {
      await this.prisma.payment.updateMany({
        where: { id: existingPayment.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      await this.prisma.paymentAttempt.create({
        data: {
          paymentId: existingPayment.id,
          amountCents: existingPayment.amountCents,
          status: 'FAILED',
          providerRef: reference,
        },
      });
      return { ok: true, status: 'FAILED', reference };
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

    // Atomically claim PENDING -> VERIFIED so duplicate webhooks or concurrent verify calls
    // can never double-settle a payment or trigger duplicate tax invoices.
    const claimed = await this.prisma.payment.updateMany({
      where: { id: existingPayment.id, status: { not: 'VERIFIED' } },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
    if (claimed.count === 0) {
      return { idempotent: true, settled: true, reference };
    }
    // Complete the checkout session so the 15-minute checkout expiry cron preserves the order's active StockHold until warehouse collection
    await this.prisma.checkoutSession.updateMany({
      where: { orderId: existingPayment.orderId, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    await this.syncOrderPaymentStatus(existingPayment.orderId);
    return { settled: true, reference };
  }

  async getCustomerStoreCredit(userIdOrProfileId: string) {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { OR: [{ userId: userIdOrProfileId }, { id: userIdOrProfileId }] },
    });
    if (!profile) {
      return { entries: [], totalAvailableCents: 0 };
    }
    const entries = await this.prisma.storeCreditEntry.findMany({
      where: {
        customerId: profile.id,
        status: { in: ['ACTIVE', 'PARTIALLY_REDEEMED'] },
        remainingCents: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });
    const totalAvailableCents = entries.reduce((s, e) => s + e.remainingCents, 0);
    return { customerId: profile.id, entries, totalAvailableCents };
  }

  async redeemStoreCredit(
    dto: { orderId: string; amountCents?: number },
    actorUserId?: string,
    actorRole?: string,
  ) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: dto.orderId },
      include: { customer: true, payments: true },
    });
    if (!order) throw new NotFoundException(`SalesOrder ${dto.orderId} not found`);
    if (!order.customerId) {
      throw new BadRequestException('Order has no linked customer profile for store credit redemption');
    }
    if (actorRole !== 'STAFF' && order.customer?.userId !== actorUserId) {
      throw new ForbiddenException('You can only redeem store credit on your own orders');
    }
    if (order.orderStatus === 'CANCELLED') {
      throw new BadRequestException('Cannot redeem store credit on a cancelled order');
    }

    const verifiedPaidCents = order.payments
      .filter((p) => p.status === 'VERIFIED')
      .reduce((s, p) => s + p.amountCents, 0);
    const remainingOrderCents = Math.max(0, order.totalCents - verifiedPaidCents);
    if (remainingOrderCents <= 0) {
      throw new BadRequestException('Order is already paid in full');
    }

    const entries = await this.prisma.storeCreditEntry.findMany({
      where: {
        customerId: order.customerId,
        status: { in: ['ACTIVE', 'PARTIALLY_REDEEMED'] },
        remainingCents: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });
    const totalCreditAvailable = entries.reduce((s, e) => s + e.remainingCents, 0);
    if (totalCreditAvailable <= 0) {
      throw new BadRequestException('No available store credit balance on this customer account');
    }

    const requestedRedeem =
      dto.amountCents && dto.amountCents > 0
        ? Math.min(dto.amountCents, remainingOrderCents, totalCreditAvailable)
        : Math.min(remainingOrderCents, totalCreditAvailable);

    const payment = await this.prisma.$transaction(async (tx) => {
      let toDeduct = requestedRedeem;
      for (const entry of entries) {
        if (toDeduct <= 0) break;
        const deduct = Math.min(entry.remainingCents, toDeduct);
        const newRemaining = entry.remainingCents - deduct;
        await tx.storeCreditEntry.update({
          where: { id: entry.id },
          data: {
            remainingCents: newRemaining,
            status: newRemaining === 0 ? 'REDEEMED' : 'PARTIALLY_REDEEMED',
          },
        });
        toDeduct -= deduct;
      }

      const ref = `AH-SC-${Date.now().toString().slice(-6)}`;
      const createdPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          amountCents: requestedRedeem,
          method: 'STORE_CREDIT',
          status: 'VERIFIED',
          reference: ref,
          recordedBy: actorUserId,
          approvedBy: actorUserId,
          verifiedAt: new Date(),
        },
      });

      await tx.checkoutSession.updateMany({
        where: { orderId: order.id, status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      });

      return createdPayment;
    });

    await this.syncOrderPaymentStatus(order.id);
    await this.audit.record({
      actorId: actorUserId,
      action: 'STORE_CREDIT_REDEEMED',
      entityType: 'Payment',
      entityId: payment.id,
      after: {
        orderId: order.id,
        redeemedCents: requestedRedeem,
        remainingOrderBalanceCents: Math.max(0, remainingOrderCents - requestedRedeem),
      },
    });

    return {
      payment,
      redeemedCents: requestedRedeem,
      remainingOrderBalanceCents: Math.max(0, remainingOrderCents - requestedRedeem),
    };
  }
}
