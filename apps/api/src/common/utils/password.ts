import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = scryptSync(password, salt, KEY_LEN);
  const keyBuf = Buffer.from(keyHex, 'hex');
  return derived.length === keyBuf.length && timingSafeEqual(derived, keyBuf);
}

/**
 * Generates a 6-digit time-based verification code (30s window) using HMAC-SHA1,
 * compatible with standard authenticator apps and deterministic tests.
 */
export function generateTotpCode(secret: string, timestampMs = Date.now()): string {
  const counter = Math.floor(timestampMs / 30000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', Buffer.from(secret, 'utf8')).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string, timestampMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const offset of [-30000, 0, 30000]) {
    if (generateTotpCode(secret, timestampMs + offset) === code) {
      return true;
    }
  }
  return false;
}
