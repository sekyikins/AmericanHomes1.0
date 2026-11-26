import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REDACTED_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'mfaSecret',
  'mfaCode',
  'otp',
  'releasePin',
  'pin',
  'base64',
  'token',
]);

function sanitizePayload(input: unknown, depth = 0): unknown {
  if (depth > 3 || input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return input.length > 300 ? `${input.slice(0, 300)}…` : input;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 20).map((item) => sanitizePayload(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizePayload(v, depth + 1);
    }
  }
  return out;
}

/**
 * Global safety-net audit interceptor: guarantees EVERY mutating staff API action
 * (POST, PUT, PATCH, DELETE) is recorded in AuditEvent even if a service method does
 * not emit its own domain-specific audit entry.
 */
@Injectable()
export class StaffAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();

    const method = (req.method ?? 'GET').toUpperCase();
    if (!MUTATING_METHODS.has(method)) return next.handle();

    const startedAt = new Date();
    const rawUrl = (req.originalUrl || req.url || '').split('?')[0];
    const requestRef =
      typeof req.headers?.['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : undefined;

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const actorId =
            req.user?.role === 'STAFF'
              ? req.user.id
              : rawUrl.includes('/auth/staff-login') &&
                  responseBody &&
                  typeof responseBody === 'object' &&
                  'userId' in responseBody
                ? String((responseBody as { userId?: string }).userId ?? '')
                : undefined;

          if (!actorId) return;

          // Run asynchronously without delaying the HTTP response
          void (async () => {
            try {
              // Skip if the service already recorded a domain-specific audit event during this request
              const alreadyLogged = await this.prisma.auditEvent.findFirst({
                where: {
                  actorId,
                  createdAt: { gte: startedAt },
                },
                select: { id: true },
              });
              if (alreadyLogged) return;

              const segments = rawUrl
                .replace(/^\/api\//, '')
                .split('/')
                .filter(Boolean);
              const moduleName = (segments[0] ?? 'STAFF').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
              const subAction = segments
                .slice(1)
                .filter((s) => s.length < 24 && !/^[a-z0-9]{20,}$/i.test(s))
                .join('_')
                .toUpperCase()
                .replace(/[^A-Z0-9_]+/g, '_');

              const action = [moduleName, method, subAction].filter(Boolean).join('_').slice(0, 80);
              const entityId =
                req.params?.id ||
                req.params?.orderId ||
                req.params?.variantId ||
                req.params?.lotId ||
                req.params?.unitId ||
                (responseBody &&
                typeof responseBody === 'object' &&
                'id' in responseBody
                  ? String((responseBody as { id?: string }).id ?? '')
                  : undefined);

              await this.prisma.auditEvent.create({
                data: {
                  actorId,
                  action,
                  entityType: moduleName,
                  entityId: entityId || undefined,
                  after: {
                    path: rawUrl,
                    method,
                    payload: sanitizePayload(req.body),
                  } as Prisma.InputJsonValue,
                  requestRef,
                },
              });
            } catch {
              // Non-blocking audit fallback
            }
          })();
        },
      }),
    );
  }
}
