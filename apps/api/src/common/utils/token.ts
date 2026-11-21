import { createHmac, timingSafeEqual } from 'crypto';

export interface SessionTokenPayload {
  sub: string;
  role: 'CUSTOMER' | 'STAFF';
  ver?: number;
  exp: number;
}

const MAX_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours max (Business Decision §4.1.5)

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signSessionToken(
  payload: Omit<SessionTokenPayload, 'exp'>,
  secret: string,
  ttlSeconds = MAX_SESSION_TTL_SECONDS,
): string {
  const boundedTtl = Math.min(Math.max(ttlSeconds, 1), MAX_SESSION_TTL_SECONDS);
  const fullPayload: SessionTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + boundedTtl,
  };
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', secret).update(data).digest('base64url');
  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(base64UrlDecode(payloadB64)) as SessionTokenPayload;
    if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
