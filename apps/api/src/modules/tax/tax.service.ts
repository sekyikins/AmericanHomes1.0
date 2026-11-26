import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nextDocumentNumber } from '../../common/utils/document-number';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EvatClient, type EvatLine, type EvatPayload } from './evat.client';

// Ghana VAT Act 2025 (Act 1151): NHIL 2.5%, GETFund 2.5%, VAT 15% on the common net value (20% total).
export interface TaxRates {
  nhilBps: number;    // 250 = 2.5%
  getFundBps: number; // 250 = 2.5%
  vatBps: number;     // 1500 = 15%
}

export const DEFAULT_GHANA_TAX_RATES: TaxRates = {
  nhilBps: 250,
  getFundBps: 250,
  vatBps: 1500,
};

export interface TaxBreakdown {
  netCents: number;
  nhilCents: number;
  getFundCents: number;
  vatCents: number;
  totalCents: number;
}

/**
 * Splits a tax-inclusive retail price (in pesewas) into Net + NHIL + GETFund + VAT so that
 * net + nhil + getFund + vat === totalCents exactly (rounding remainder absorbed by net).
 */
export function decomposeInclusiveTax(
  totalCents: number,
  rates: TaxRates = DEFAULT_GHANA_TAX_RATES,
): TaxBreakdown {
  const sign = totalCents < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(totalCents));
  const combinedBps = rates.nhilBps + rates.getFundBps + rates.vatBps;
  if (combinedBps <= 0 || abs === 0) {
    return { netCents: totalCents, nhilCents: 0, getFundCents: 0, vatCents: 0, totalCents };
  }
  const exactNet = (abs * 10_000) / (10_000 + combinedBps);
  const nhil = Math.round((exactNet * rates.nhilBps) / 10_000);
  const getFund = Math.round((exactNet * rates.getFundBps) / 10_000);
  const vat = Math.round((exactNet * rates.vatBps) / 10_000);
  const net = abs - nhil - getFund - vat;
  return {
    netCents: sign * net,
    nhilCents: sign * nhil,
    getFundCents: sign * getFund,
    vatCents: sign * vat,
    totalCents: sign * abs,
  };
}

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evat: EvatClient,
    private readonly audit: AuditService,
  ) {}

  getSellerInfo() {
    return {
      ...this.evat.seller,
      evatMode: this.evat.isLive() ? 'LIVE' : 'SANDBOX',
    };
  }

  async getConfiguredRates(): Promise<TaxRates> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: ['TAX_NHIL_BPS', 'TAX_GETFUND_BPS', 'TAX_VAT_BPS'] } },
    });
    const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
    const pick = (k: string, fallback: number) => {
      const v = map.get(k);
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;
    };
    return {
      nhilBps: pick('TAX_NHIL_BPS', DEFAULT_GHANA_TAX_RATES.nhilBps),
      getFundBps: pick('TAX_GETFUND_BPS', DEFAULT_GHANA_TAX_RATES.getFundBps),
      vatBps: pick('TAX_VAT_BPS', DEFAULT_GHANA_TAX_RATES.vatBps),
    };
  }

  listInvoices(status?: string) {
    return this.prisma.taxInvoice.findMany({
      where: status ? { status } : undefined,
      include: {
        order: { select: { id: true, reference: true, paymentStatus: true, orderStatus: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
  }

  async getForOrder(orderId: string, actor?: { id: string; role?: string }) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException(`SalesOrder ${orderId} not found`);
    if (actor && actor.role !== 'STAFF' && order.customer?.userId !== actor.id) {
      throw new ForbiddenException('You can only view tax invoices for your own orders');
    }
    const invoices = await this.prisma.taxInvoice.findMany({
      where: { orderId },
      orderBy: { issuedAt: 'asc' },
    });
    return { seller: this.getSellerInfo(), invoices };
  }

  /**
   * Issues a gap-free sequential tax invoice for a paid order (idempotent: returns the existing
   * invoice if one has already been issued for the order) and submits it to GRA E-VAT.
   */
  async issueForOrder(
    orderId: string,
    opts?: { customerTin?: string; actorId?: string },
  ) {
    const existing = await this.prisma.taxInvoice.findFirst({
      where: { orderId, documentType: 'INVOICE' },
    });
    if (existing) {
      if (existing.status === 'FAILED' || existing.status === 'PENDING') {
        return this.submitToEvat(existing.id);
      }
      return existing;
    }

    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { user: true } },
        lines: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!order) throw new NotFoundException(`SalesOrder ${orderId} not found`);
    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        `Tax invoice can only be issued once order is PAID (current: ${order.paymentStatus})`,
      );
    }

    const rates = await this.getConfiguredRates();
    const evatLines: EvatLine[] = order.lines.map((l) => {
      const lineTotal = Math.max(0, l.unitPriceCents * l.quantity - (l.discountCents ?? 0));
      const b = decomposeInclusiveTax(lineTotal, rates);
      const name = l.variant?.product?.name ?? l.variant?.name ?? l.variant?.sku ?? 'Item';
      return {
        description: l.variant?.sku ? `${name} (${l.variant.sku})` : name,
        quantity: l.quantity,
        unitPriceNetCents: l.quantity > 0 ? Math.round(b.netCents / l.quantity) : b.netCents,
        ...b,
      };
    });

    const totals = evatLines.reduce(
      (acc, l) => ({
        netCents: acc.netCents + l.netCents,
        nhilCents: acc.nhilCents + l.nhilCents,
        getFundCents: acc.getFundCents + l.getFundCents,
        vatCents: acc.vatCents + l.vatCents,
        totalCents: acc.totalCents + l.totalCents,
      }),
      { netCents: 0, nhilCents: 0, getFundCents: 0, vatCents: 0, totalCents: 0 },
    );

    const year = new Date().getFullYear();
    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(tx, `TAX_INV_${year}`, `AH-INV-${year}`);
      return tx.taxInvoice.create({
        data: {
          invoiceNumber,
          documentType: 'INVOICE',
          orderId: order.id,
          customerName: order.customer?.user?.name ?? 'Walk-in Customer',
          customerPhone: order.customer?.user?.phone ?? undefined,
          customerTin: opts?.customerTin?.trim() || undefined,
          ...totals,
          rateSnapshot: rates as unknown as Prisma.InputJsonValue,
          lines: evatLines as unknown as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });
    });

    await this.audit.record({
      actorId: opts?.actorId,
      action: 'TAX_INVOICE_ISSUED',
      entityType: 'TaxInvoice',
      entityId: invoice.id,
      after: { invoiceNumber: invoice.invoiceNumber, orderId: order.id, totalCents: totals.totalCents },
    });

    return this.submitToEvat(invoice.id);
  }

  /**
   * Issues a sequential VAT credit note referencing the original tax invoice (used on refunds
   * and cancellations of invoiced orders).
   */
  async issueCreditNote(
    orderId: string,
    amountCents: number,
    reason: string,
    actorId?: string,
  ) {
    const original = await this.prisma.taxInvoice.findFirst({
      where: { orderId, documentType: 'INVOICE' },
    });
    if (!original) return null; // Order was never invoiced; no credit note required.

    const abs = Math.min(Math.abs(Math.round(amountCents)), original.totalCents);
    if (abs <= 0) return null;

    const rates = (original.rateSnapshot as unknown as TaxRates) ?? DEFAULT_GHANA_TAX_RATES;
    const b = decomposeInclusiveTax(-abs, rates);
    const cnLine: EvatLine = {
      description: `Credit note for ${original.invoiceNumber}: ${reason}`,
      quantity: 1,
      unitPriceNetCents: b.netCents,
      ...b,
    };

    const year = new Date().getFullYear();
    const creditNote = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(tx, `TAX_CN_${year}`, `AH-CN-${year}`);
      return tx.taxInvoice.create({
        data: {
          invoiceNumber,
          documentType: 'CREDIT_NOTE',
          orderId,
          originalInvoiceId: original.id,
          customerName: original.customerName,
          customerPhone: original.customerPhone,
          customerTin: original.customerTin,
          ...b,
          rateSnapshot: rates as unknown as Prisma.InputJsonValue,
          lines: [cnLine] as unknown as Prisma.InputJsonValue,
          reason,
          status: 'PENDING',
        },
      });
    });

    await this.audit.record({
      actorId,
      action: 'TAX_CREDIT_NOTE_ISSUED',
      entityType: 'TaxInvoice',
      entityId: creditNote.id,
      after: {
        invoiceNumber: creditNote.invoiceNumber,
        originalInvoiceNumber: original.invoiceNumber,
        amountCents: -abs,
        reason,
      },
    });

    return this.submitToEvat(creditNote.id);
  }

  async submitToEvat(invoiceId: string) {
    const inv = await this.prisma.taxInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException(`TaxInvoice ${invoiceId} not found`);
    if (inv.status === 'CLEARED') return inv;

    let originalInvoiceNumber: string | undefined;
    if (inv.originalInvoiceId) {
      const orig = await this.prisma.taxInvoice.findUnique({
        where: { id: inv.originalInvoiceId },
        select: { invoiceNumber: true },
      });
      originalInvoiceNumber = orig?.invoiceNumber;
    }

    const payload: EvatPayload = {
      documentType: inv.documentType === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : 'INVOICE',
      invoiceNumber: inv.invoiceNumber,
      originalInvoiceNumber,
      issuedAt: inv.issuedAt.toISOString(),
      currency: 'GHS',
      seller: this.evat.seller,
      buyer: {
        name: inv.customerName ?? undefined,
        tin: inv.customerTin ?? undefined,
        phone: inv.customerPhone ?? undefined,
      },
      lines: (inv.lines as unknown as EvatLine[]) ?? [],
      totals: {
        netCents: inv.netCents,
        nhilCents: inv.nhilCents,
        getFundCents: inv.getFundCents,
        vatCents: inv.vatCents,
        totalCents: inv.totalCents,
      },
    };

    try {
      const res = await this.evat.clear(payload);
      return await this.prisma.taxInvoice.update({
        where: { id: inv.id },
        data: {
          status: res.status,
          isSandbox: res.status === 'SANDBOX',
          evatReference: res.reference,
          evatQrCode: res.qrCode,
          evatSignature: res.signature,
          evatClearedAt: new Date(),
          evatAttempts: { increment: 1 },
          evatLastError: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'E-VAT submission failed';
      this.logger.error(`E-VAT failed for ${inv.invoiceNumber}: ${message}`);
      return this.prisma.taxInvoice.update({
        where: { id: inv.id },
        data: {
          status: 'FAILED',
          evatAttempts: { increment: 1 },
          evatLastError: message,
        },
      });
    }
  }
}
