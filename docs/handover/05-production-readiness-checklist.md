# AmericanHomes — Production Readiness Checklist

**Last Updated:** 21 November 2026  
**Target Stack:** Next.js 14 (`apps/web`), NestJS (`apps/api`), PostgreSQL / Supabase (`prisma/schema.prisma`), Paystack, Arkesel SMS/OTP, WhatsApp Business API, Supabase Storage.

---

## 1. Hosting & Infrastructure
- [ ] Provision isolated production hosting for `apps/api` (Node.js 20+, port `3001` or `PORT`) and `apps/web` (Next.js production server or Vercel).
- [ ] Configure `NODE_ENV=production` in both environments.
- [x] Restrict `CORS_ORIGINS` on `apps/api` (`apps/api/src/main.ts`) to require explicit non-wildcard origins in `NODE_ENV=production` (configure exact domain values in `.env.production`).
- [ ] Enforce HTTPS / TLS termination at the hosting edge (`https://...`), with HTTP-to-HTTPS redirect.
- [x] Gate Swagger UI (`/api/docs` in `apps/api/src/main.ts`) so it is disabled in `NODE_ENV=production` unless `ENABLE_SWAGGER=true`.
- [x] Add HTTP security headers (`SecurityHeadersMiddleware` in `apps/api` + `headers()` in `apps/web/next.config.mjs`, `x-powered-by` disabled).
- [x] Add rate limiting (`AuthRateLimitMiddleware` on `/api/auth/*` returning `429` + `Retry-After`).

## 2. Database Provisioning & Migrations
- [ ] Provision a dedicated production PostgreSQL / Supabase instance **separate** from development/staging/UAT.
- [ ] Set pooled `DATABASE_URL` (with `pgbouncer=true` if using Supabase transaction pooler) and direct `DIRECT_URL` (for Prisma schema push/migrations).
- [ ] Restrict database network access (SSL required, IP allowlist / VPC peering, least-privilege DB role).
- [ ] Enable automated daily database backups and Point-in-Time Recovery (PITR) on Supabase/PostgreSQL.
- [ ] Verify backup restoration procedure on a non-production clone (see `07-backup-and-restoration-guide.md`).

## 3. Environment Variables & Secrets
- [ ] Generate a strong, unique 256-bit `JWT_SECRET` (do not use the development fallback `'dev-jwt-secret-change-in-prod'`).
- [ ] Store all secrets in the hosting provider's encrypted secret manager (never commit `.env` files to Git).
- [ ] Verify required variables:
  - `DATABASE_URL`, `DIRECT_URL`
  - `JWT_SECRET`, `CORS_ORIGINS`
  - `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`
  - `OTP_PROVIDER_URL`, `OTP_API_KEY` (Arkesel)
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_WEBHOOK_SECRET`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `STORAGE_BUCKET`
  - `NEXT_PUBLIC_API_BASE_URL` (pointing to production `https://api.<domain>/api`)

## 4. Integration Readiness Status (Local vs. Sandbox vs. Production)

| Integration | Code Status | Local / Unit Verified | Provider Sandbox Verified | Production Credentials Verified |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL / Prisma** | Implemented (`62` models) | Yes (`db push`, E2E suites) | Staging Supabase DB verified | **Pending** (Prod DB provisioning) |
| **Paystack Checkout & Webhooks** | Implemented (`PaystackService`, HMAC-SHA512 webhook, `verifyPayment` settlement) | Yes (signed webhook & duplicate idempotency E2E) | **Pending** live Paystack test keys | **Pending** (Live keys + webhook URL) |
| **OTP / SMS (Arkesel)** | Implemented (`OtpService` stateful SHA-256 + `'123456'` dummy fallback) | Yes (dummy mode verified) | **Pending** (Real HTTP dispatch to `OTP_PROVIDER_URL` awaiting live Arkesel keys) | **Pending** |
| **WhatsApp Business Outbox** | Implemented (`OutboxProcessor` + `NotificationDeliveryAttempt` logging) | Yes (outbox & consent logging verified) | **Pending** (WhatsApp Business token/phone ID not yet configured) | **Pending** |
| **Object Storage (`StorageService`)** | Implemented (`GovernanceService` + Supabase Storage) | Yes (local/adapter compiles) | **Pending** (Bucket policies & signed URLs in prod Supabase) | **Pending** |

## 5. Initial Owner Provisioning & Operational Readiness
- [ ] Seed or provision the initial Owner (`Mr. Zero`, `isOwner: true`) with a strong unique password and enable TOTP MFA (`/auth/staff-mfa/setup` -> `/auth/staff-mfa/enable`).
- [ ] Review and confirm all `OD-01`–`OD-32` configurable thresholds in `/staff/settings` (`SystemSetting`) before opening to customers.
- [ ] Configure log aggregation, health check monitoring (`GET /api/health`), and error alerting.
