import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(
    _req: unknown,
    res: { setHeader: (name: string, value: string) => void; removeHeader?: (name: string) => void },
    next: () => void,
  ): void {
    res.removeHeader?.('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  }
}

type RateEntry = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private readonly hits = new Map<string, RateEntry>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20);

  use(
    req: { method?: string; ip?: string; headers: Record<string, string | string[] | undefined>; originalUrl?: string },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ): void {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ||
      req.ip ||
      'unknown';
    const key = `${ip}:${req.originalUrl ?? 'auth'}`;
    const now = Date.now();
    const current = this.hits.get(key);

    if (!current || now > current.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, this.maxRequests - 1)));
      next();
      return;
    }

    current.count += 1;
    const remaining = Math.max(0, this.maxRequests - current.count);
    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (current.count > this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        `Too many authentication requests. Please retry in ${retryAfterSec} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
