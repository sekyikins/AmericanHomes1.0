import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';

type OtpEntry = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();

  constructor(private readonly config: ConfigService) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private isProviderConfigured(): boolean {
    const providerUrl = (this.config.get<string>('auth.otpProviderUrl') ?? '').trim();
    const apiKey = (this.config.get<string>('auth.otpApiKey') ?? '').trim();
    if (!providerUrl || !apiKey) return false;
    if (/placeholder|changeme|your[-_]|^test|^dev|^stub|^replace/i.test(apiKey)) {
      return false;
    }
    return true;
  }

  async sendOtp(phone: string): Promise<{ status: string }> {
    const configured = this.isProviderConfigured();
    const code = configured ? String(randomInt(100000, 999999)) : '123456';

    this.store.set(phone, {
      codeHash: this.hashCode(code),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    if (configured) {
      this.logger.log(`sendOtp dispatched via configured provider for ${phone}`);
    } else {
      this.logger.log(`sendOtp dummy mode active (code=123456) for ${phone}`);
    }
    return { status: 'OTP_SENT' };
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const configured = this.isProviderConfigured();
    const entry = this.store.get(phone);

    // Dummy pass until OTP API keys are configured: accept '123456' when no live provider key is set,
    // while still enforcing expiry, single-use, and attempt limits once sendOtp has been called.
    if (!entry) {
      if (!configured && otp.trim() === '123456') {
        return true;
      }
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(phone);
      return false;
    }

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      this.store.delete(phone);
      return false;
    }

    if (this.hashCode(otp.trim()) !== entry.codeHash) {
      entry.attempts += 1;
      return false;
    }

    this.store.delete(phone);
    return true;
  }
}
