import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';

type OtpEntry = {
  codeHash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Normalizes Ghanaian and international phone numbers to digits-only format
 * expected by Arkesel (e.g. "+233 24 123 4567" -> "233241234567", "0241234567" -> "233241234567").
 */
export function normalizeGhanaPhoneForSms(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }
  if (digits.startsWith('233')) {
    return digits;
  }
  return digits;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();

  constructor(private readonly config: ConfigService) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private getProviderConfig() {
    const providerUrl = (this.config.get<string>('auth.otpProviderUrl') ?? '')
      .trim()
      .replace(/\/+$/, '');
    const apiKey = (this.config.get<string>('auth.otpApiKey') ?? '').trim();
    const senderId = (process.env.OTP_SENDER_ID ?? 'AmHomesGH').trim().slice(0, 11);
    return { providerUrl, apiKey, senderId };
  }

  private isDummyModeAllowed(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return process.env.OTP_DUMMY_MODE === 'true';
  }

  isProviderConfigured(): boolean {
    if (this.isDummyModeAllowed()) return false;
    const { providerUrl, apiKey } = this.getProviderConfig();
    if (!providerUrl || !apiKey) return false;
    if (/placeholder|changeme|your[-_]|^test|^dev|^stub|^replace/i.test(apiKey)) {
      return false;
    }
    return true;
  }

  async sendOtp(phone: string): Promise<{ status: string; provider: 'ARKESEL' | 'DEV_DUMMY' }> {
    const normalized = normalizeGhanaPhoneForSms(phone);
    const existing = this.store.get(normalized);
    if (existing && Date.now() - existing.sentAt < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.sentAt)) / 1000);
      throw new HttpException(
        `Please wait ${waitSec} seconds before requesting another verification code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.isProviderConfigured()) {
      const { providerUrl, apiKey, senderId } = this.getProviderConfig();
      let response: Response;
      try {
        response = await fetch(`${providerUrl}/api/otp/generate`, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expiry: 5,
            length: 6,
            medium: 'sms',
            message:
              'Your AmericanHomes verification code is %otp_code%. It expires in 5 minutes.',
            number: normalized,
            sender_id: senderId,
            type: 'numeric',
          }),
        });
      } catch (err) {
        this.logger.error(
          `Arkesel network failure for ***${normalized.slice(-4)}: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new BadGatewayException(
          'SMS verification provider is currently unreachable. Please try again shortly.',
        );
      }

      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (!response.ok || (payload.code && payload.code !== '1000')) {
        this.logger.error(
          `Arkesel OTP generate rejected for ***${normalized.slice(-4)}: status=${response.status} code=${payload.code ?? 'none'} msg=${payload.message ?? 'unknown'}`,
        );
        throw new BadGatewayException(
          payload.message ?? 'Failed to dispatch verification SMS via Arkesel.',
        );
      }

      const now = Date.now();
      this.store.set(normalized, {
        codeHash: 'ARKESEL_MANAGED',
        expiresAt: now + OTP_TTL_MS,
        sentAt: now,
        attempts: 0,
      });
      this.logger.log(`Arkesel OTP dispatched to ***${normalized.slice(-4)}`);
      return { status: 'OTP_SENT', provider: 'ARKESEL' };
    }

    if (!this.isDummyModeAllowed()) {
      this.logger.error('SMS OTP provider is not configured and dummy mode is disabled');
      throw new ServiceUnavailableException(
        'SMS verification service is not configured. Contact the system administrator.',
      );
    }

    // Non-production explicit OTP_DUMMY_MODE=true fallback only (never reachable in production)
    const devCode = process.env.OTP_DEV_FIXED_CODE?.trim() || String(randomInt(100000, 999999));
    const now = Date.now();
    this.store.set(normalized, {
      codeHash: this.hashCode(devCode),
      expiresAt: now + OTP_TTL_MS,
      sentAt: now,
      attempts: 0,
    });
    this.logger.warn(`Non-production OTP_DUMMY_MODE active for ***${normalized.slice(-4)}`);
    return { status: 'OTP_SENT', provider: 'DEV_DUMMY' };
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const normalized = normalizeGhanaPhoneForSms(phone);
    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return false;
    }

    const entry = this.store.get(normalized);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.store.delete(normalized);
        return false;
      }
      if (entry.attempts >= MAX_OTP_ATTEMPTS) {
        this.store.delete(normalized);
        return false;
      }
    }

    if (this.isProviderConfigured()) {
      const { providerUrl, apiKey } = this.getProviderConfig();
      let response: Response;
      try {
        response = await fetch(`${providerUrl}/api/otp/verify`, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: trimmedOtp,
            number: normalized,
          }),
        });
      } catch (err) {
        this.logger.error(
          `Arkesel OTP verify network failure for ***${normalized.slice(-4)}: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new BadGatewayException(
          'Unable to verify code with SMS provider. Please try again shortly.',
        );
      }

      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (response.ok && payload.code === '1100') {
        this.store.delete(normalized);
        return true;
      }
      if (entry) {
        entry.attempts += 1;
        if (entry.attempts >= MAX_OTP_ATTEMPTS) {
          this.store.delete(normalized);
        }
      }
      return false;
    }

    if (!this.isDummyModeAllowed() || !entry) {
      return false;
    }
    if (this.hashCode(trimmedOtp) !== entry.codeHash) {
      entry.attempts += 1;
      if (entry.attempts >= MAX_OTP_ATTEMPTS) {
        this.store.delete(normalized);
      }
      return false;
    }

    this.store.delete(normalized);
    return true;
  }
}
