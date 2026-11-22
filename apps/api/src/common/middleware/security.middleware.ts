import { HttpException, HttpStatus, Injectable, Logger, NestMiddleware } from '@nestjs/common';

type RateEntry = { count: number; resetAt: number };

function extractClientIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  return (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ||
    req.ip ||
    'unknown'
  );
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(
    req: { originalUrl?: string },
    res: { setHeader: (name: string, value: string) => void; removeHeader?: (name: string) => void },
    next: () => void,
  ): void {
    res.removeHeader?.('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (!req.originalUrl?.startsWith('/api/docs')) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  }
}

@Injectable()
export class HttpsEnforcementMiddleware implements NestMiddleware {
  use(
    req: {
      originalUrl?: string;
      headers: Record<string, string | string[] | undefined>;
      secure?: boolean;
    },
    _res: unknown,
    next: () => void,
  ): void {
    if (process.env.NODE_ENV === 'production' && !req.originalUrl?.startsWith('/api/health')) {
      const protoHeader = req.headers['x-forwarded-proto'];
      const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
      const host = String(req.headers.host ?? '');
      const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
      if (!isLocal && proto && proto.toLowerCase() !== 'https') {
        throw new HttpException('HTTPS is required in production', HttpStatus.FORBIDDEN);
      }
    }
    next();
  }
}

@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Security');

  use(
    req: {
      method?: string;
      originalUrl?: string;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
    _res: unknown,
    next: () => void,
  ): void {
    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      next();
      return;
    }
    // Paystack webhook is verified via x-paystack-signature HMAC
    if (req.originalUrl?.startsWith('/api/payments/webhook')) {
      next();
      return;
    }

    const originHeader = req.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    if (origin) {
      const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (!allowed.includes(origin)) {
        this.logger.warn(
          `[SECURITY] Blocked cross-origin ${method} ${req.originalUrl} origin=${origin} ip=${extractClientIp(req)}`,
        );
        throw new HttpException('Cross-origin request blocked by CSRF policy', HttpStatus.FORBIDDEN);
      }
    }
    next();
  }
}

function createRateLimiter(options: { windowMs: number; maxRequests: number; scope: string }) {
  const hits = new Map<string, RateEntry>();
  const logger = new Logger('RateLimit');

  const pruneExpired = (now: number) => {
    if (hits.size < 2000) return;
    for (const [k, v] of hits.entries()) {
      if (now > v.resetAt) hits.delete(k);
    }
  };

  return (
    req: {
      method?: string;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      originalUrl?: string;
    },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ): void => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }
    const now = Date.now();
    pruneExpired(now);
    const ip = extractClientIp(req);
    const key = `${options.scope}:${ip}:${req.originalUrl ?? ''}`;
    const current = hits.get(key);

    if (!current || now > current.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - 1)));
      next();
      return;
    }

    current.count += 1;
    const remaining = Math.max(0, options.maxRequests - current.count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (current.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      logger.warn(
        `[SECURITY] Rate limit exceeded scope=${options.scope} ip=${ip} path=${req.originalUrl ?? ''}`,
      );
      throw new HttpException(
        `Too many requests. Please retry in ${retryAfterSec} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  };
}

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private readonly handler = createRateLimiter({
    windowMs: 60_000,
    maxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
    scope: 'auth',
  });

  use(
    req: { method?: string; ip?: string; headers: Record<string, string | string[] | undefined>; originalUrl?: string },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ): void {
    this.handler(req, res, next);
  }
}

@Injectable()
export class ApiRateLimitMiddleware implements NestMiddleware {
  private readonly handler = createRateLimiter({
    windowMs: 60_000,
    maxRequests: Number(process.env.API_RATE_LIMIT_MAX ?? 180),
    scope: 'api',
  });

  use(
    req: { method?: string; ip?: string; headers: Record<string, string | string[] | undefined>; originalUrl?: string },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ): void {
    this.handler(req, res, next);
  }
}

@Injectable()
export class UploadRateLimitMiddleware implements NestMiddleware {
  private readonly handler = createRateLimiter({
    windowMs: 60_000,
    maxRequests: Number(process.env.UPLOAD_RATE_LIMIT_MAX ?? 15),
    scope: 'upload',
  });

  use(
    req: { method?: string; ip?: string; headers: Record<string, string | string[] | undefined>; originalUrl?: string },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ): void {
    this.handler(req, res, next);
  }
}
