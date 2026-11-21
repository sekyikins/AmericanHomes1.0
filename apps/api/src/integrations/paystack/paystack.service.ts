import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string {
    return this.config.get<string>('integrations.paystackSecretKey') ?? '';
  }

  async initializeTransaction(
    email: string,
    amountPesewas: number,
    metadata?: Record<string, unknown>,
  ) {
    if (!this.secretKey) {
      this.logger.log(`initializeTransaction stub email=${email} amount=${amountPesewas}`);
      return { authorizationUrl: 'stub', reference: `PAY-${Date.now()}`, metadata };
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: 'GHS',
        metadata,
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { authorization_url: string; reference: string; access_code: string };
    };
    if (!res.ok || !json.status || !json.data) {
      throw new Error(json.message ?? 'Paystack initialization failed');
    }
    return {
      authorizationUrl: json.data.authorization_url,
      reference: json.data.reference,
      accessCode: json.data.access_code,
      metadata,
    };
  }

  async verifyTransaction(reference: string) {
    if (!this.secretKey) {
      this.logger.log(`verifyTransaction stub reference=${reference}`);
      return { status: 'success', reference, amountPesewas: 0 };
    }

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );
    const json = (await res.json()) as {
      status: boolean;
      data?: { status: string; reference: string; amount: number };
    };
    return {
      status: json.data?.status ?? 'failed',
      reference: json.data?.reference ?? reference,
      amountPesewas: json.data?.amount ?? 0,
    };
  }

  async createRefund(transactionId: string, amountPesewas: number) {
    if (!this.secretKey) {
      this.logger.log(`createRefund stub tx=${transactionId} amount=${amountPesewas}`);
      return { status: 'pending', transactionId };
    }

    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction: transactionId, amount: amountPesewas }),
    });
    const json = (await res.json()) as { status: boolean; data?: Record<string, unknown> };
    return { status: json.status ? 'pending' : 'failed', transactionId, data: json.data };
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    if (!this.secretKey) return true;
    if (!signature) return false;
    const expected = createHmac('sha512', this.secretKey)
      .update(rawPayload)
      .digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  }
}
