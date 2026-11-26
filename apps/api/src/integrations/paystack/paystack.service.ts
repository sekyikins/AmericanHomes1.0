import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string {
    return (this.config.get<string>('integrations.paystackSecretKey') ?? '').trim();
  }

  getMode(): 'LIVE' | 'TEST' | 'UNCONFIGURED' {
    const key = this.secretKey;
    if (!key) return 'UNCONFIGURED';
    if (key.startsWith('sk_live_')) return 'LIVE';
    if (key.startsWith('sk_test_')) return 'TEST';
    return 'UNCONFIGURED';
  }

  private assertConfigured(): string {
    const key = this.secretKey;
    if (!key) {
      throw new ServiceUnavailableException(
        'Paystack payment gateway is not configured (missing PAYSTACK_SECRET_KEY).',
      );
    }
    if (process.env.NODE_ENV === 'production' && !key.startsWith('sk_live_')) {
      this.logger.error('FATAL: Non-live PAYSTACK_SECRET_KEY detected in production environment');
      throw new ServiceUnavailableException(
        'Paystack live secret key (sk_live_...) is required in production.',
      );
    }
    return key;
  }

  async initializeTransaction(
    email: string,
    amountPesewas: number,
    metadata?: Record<string, unknown>,
  ) {
    const key = this.assertConfigured();
    const callbackBase = (
      process.env.FRONTEND_URL ??
      process.env.CORS_ORIGINS?.split(',')[0] ??
      'http://localhost:3000'
    )
      .trim()
      .replace(/\/+$/, '');

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: 'GHS',
        channels: ['card', 'mobile_money'],
        callback_url: `${callbackBase}/account/payments`,
        metadata,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url: string; reference: string; access_code: string };
    };
    if (!res.ok || !json.status || !json.data) {
      this.logger.error(`Paystack initialize failed: status=${res.status} msg=${json.message ?? 'unknown'}`);
      throw new Error(json.message ?? 'Paystack initialization failed');
    }
    return {
      authorizationUrl: json.data.authorization_url,
      reference: json.data.reference,
      accessCode: json.data.access_code,
      mode: this.getMode(),
      metadata,
    };
  }

  async verifyTransaction(reference: string) {
    const key = this.assertConfigured();

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: {
        status?: string;
        reference?: string;
        amount?: number;
        currency?: string;
        channel?: string;
        gateway_response?: string;
      };
    };
    return {
      status: json.data?.status ?? 'failed',
      reference: json.data?.reference ?? reference,
      amountPesewas: json.data?.amount ?? 0,
      currency: json.data?.currency ?? 'GHS',
      channel: json.data?.channel,
      gatewayResponse: json.data?.gateway_response ?? json.message,
      mode: this.getMode(),
      isStub: false,
    };
  }

  async createRefund(transactionId: string, amountPesewas: number) {
    const key = this.assertConfigured();

    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction: transactionId, amount: amountPesewas }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    };
    return {
      status: res.ok && json.status ? 'pending' : 'failed',
      transactionId,
      message: json.message,
      data: json.data,
    };
  }

  verifyWebhookSignature(rawPayload: Buffer | string, signature: string): boolean {
    const key = this.secretKey;
    if (!key || !signature) return false;
    const expected = createHmac('sha512', key).update(rawPayload).digest('hex');
    const sigBuf = Buffer.from(signature.trim());
    const expBuf = Buffer.from(expected);
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  }
}
