import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export interface EvatLine {
  description: string;
  quantity: number;
  unitPriceNetCents: number;
  netCents: number;
  nhilCents: number;
  getFundCents: number;
  vatCents: number;
  totalCents: number;
}

export interface EvatPayload {
  documentType: 'INVOICE' | 'CREDIT_NOTE';
  invoiceNumber: string;
  originalInvoiceNumber?: string;
  issuedAt: string;
  currency: 'GHS';
  seller: { tin: string; name: string; address: string };
  buyer: { name?: string; tin?: string; phone?: string };
  lines: EvatLine[];
  totals: {
    netCents: number;
    nhilCents: number;
    getFundCents: number;
    vatCents: number;
    totalCents: number;
  };
}

export interface EvatResult {
  status: 'CLEARED' | 'SANDBOX';
  reference: string;
  qrCode: string;
  signature: string;
  raw?: unknown;
}

/**
 * Adapter for the GRA Certified Invoicing System (E-VAT / VSDC).
 *
 * LIVE mode is used only when GRA_EVAT_BASE_URL, GRA_EVAT_API_KEY and GRA_EVAT_TIN are set.
 * The request/response contract below is a generic JSON mapping and MUST be aligned with the
 * schema issued to you during GRA onboarding/certification. Until then the client runs in
 * SANDBOX mode, which produces locally-signed documents that are clearly flagged as NOT
 * GRA-cleared and are not legally valid tax invoices.
 */
@Injectable()
export class EvatClient {
  private readonly logger = new Logger(EvatClient.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return String(this.config.get('integrations.evatBaseUrl') ?? '').replace(/\/+$/, '');
  }
  private get apiKey(): string {
    return String(this.config.get('integrations.evatApiKey') ?? '');
  }

  get seller() {
    return {
      tin: String(this.config.get('integrations.evatTin') ?? ''),
      name: String(this.config.get('integrations.evatBusinessName') ?? 'AmericanHomes Ltd'),
      address: String(
        this.config.get('integrations.evatBusinessAddress') ?? 'Tema Warehouse Showroom, Ghana',
      ),
    };
  }

  isLive(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.seller.tin);
  }

  async clear(payload: EvatPayload): Promise<EvatResult> {
    if (!this.isLive()) return this.sandbox(payload);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${this.baseUrl}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(`E-VAT rejected invoice (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
      }
      const reference = String(body.reference ?? body.id ?? body.invoiceId ?? '');
      const qrCode = String(body.qrCode ?? body.qr ?? '');
      const signature = String(body.signature ?? body.digitalSignature ?? '');
      if (!reference || !qrCode) {
        throw new Error('E-VAT response missing reference or QR code; invoice not cleared');
      }
      return { status: 'CLEARED', reference, qrCode, signature, raw: body };
    } finally {
      clearTimeout(timer);
    }
  }

  private sandbox(payload: EvatPayload): EvatResult {
    this.logger.warn(
      `E-VAT credentials not configured: ${payload.invoiceNumber} signed in SANDBOX mode (not GRA-cleared)`,
    );
    const signature = createHmac('sha256', 'sandbox-not-valid-for-tax')
      .update(`${payload.invoiceNumber}|${payload.totals.totalCents}|${payload.issuedAt}`)
      .digest('hex');
    return {
      status: 'SANDBOX',
      reference: `SBX-${payload.invoiceNumber}`,
      qrCode: `SANDBOX|${payload.invoiceNumber}|${payload.totals.totalCents}|${signature.slice(0, 16)}`,
      signature,
    };
  }
}
