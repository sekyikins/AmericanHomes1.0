# AmericanHomes — Deployment & Rollback Guide

## 1. Pre-Deployment Verification
1. Ensure clean build and typecheck on the release commit:
   - `pnpm -r typecheck`
   - `pnpm --filter @americanhomes/api build`
   - `pnpm --filter @americanhomes/web build`
2. Run automated security & workflow tests against an isolated staging/test database:
   - `node --test apps/api/test/phase1-security-invariants.spec.mjs apps/web/test/interactions.spec.mjs`
   - `node --test apps/api/test/phase2-workflows.spec.mjs apps/api/test/phase2-e2e-coverage.spec.mjs`

## 2. Database Schema Rollout
1. Take a manual snapshot/backup of the target database before applying schema changes.
2. Run `npx prisma db push` (or `prisma migrate deploy` once migration history is baselined) using `DIRECT_URL`.
3. Run `npx prisma generate` if deploying from source.
4. Verify schema sync and confirm `GET /api/health` returns `200 OK`.

## 3. Application Deployment Order
1. **Deploy `apps/api` first** (ensuring backward-compatible API changes are live before frontend clients request them):
   - Start command: `node apps/api/dist/main.js`
   - Health probe: `GET /api/health`
2. **Deploy `apps/web` second**:
   - Ensure `NEXT_PUBLIC_API_BASE_URL` points to the live `apps/api` URL (`https://<api-domain>/api`).
   - Start command: `pnpm --filter @americanhomes/web start`
3. **Verify post-deploy smoke checks**:
   - Customer storefront `/shop` loads published products.
   - Staff `/staff/login` authenticates and loads `/staff/dashboard`.
   - Paystack webhook endpoint `POST /api/payments/webhook` is reachable over HTTPS.

## 4. Rollback Procedure
1. **Application Rollback (No Schema Breaking Changes)**:
   - Re-deploy the previous known-good container/artifact tag for `apps/web` and `apps/api`.
   - Verify `/api/health` and `/staff/login`.
2. **Database Rollback (If Schema Migration Caused Regression)**:
   - Stop `apps/api` traffic (enable maintenance page) to prevent partial writes.
   - Restore the pre-deployment database snapshot/PITR point (see `07-backup-and-restoration-guide.md`).
   - Re-deploy the previous `apps/api` and `apps/web` release artifacts.
   - Re-open traffic and verify recent audit/payment records.
