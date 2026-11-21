# AmericanHomes — Backup & Restoration Guide

## 1. Backup Policy
- **Database**: PostgreSQL (Supabase) automated daily backups + Point-in-Time Recovery (PITR) enabled for production.
- **Pre-Release Snapshots**: Always take a manual logical dump or Supabase snapshot immediately prior to any schema change or major release.
- **Storage Assets**: Product photos, receiving evidence, and manual payment receipts in `STORAGE_BUCKET` should have bucket versioning / lifecycle retention enabled.

## 2. Logical Backup Command (Manual)
Using `DIRECT_URL` (never the transaction pooler URL):
```bash
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges -f americanhomes-backup-$(date +%Y%m%d-%H%M%S).dump
```
Store backup files in encrypted, access-controlled off-site storage. Never commit database dumps to the repository.

## 3. Restoration Procedure (Staging Verification & Disaster Recovery)
1. **Isolate Target**: Never restore directly over an active production database while `apps/api` is serving live traffic. Put the API in maintenance mode first.
2. **Restore into Target Database**:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" americanhomes-backup-YYYYMMDD-HHMMSS.dump
   ```
   *(Or use Supabase Dashboard -> Database -> Backups / PITR to restore to a specific timestamp.)*
3. **Post-Restore Integrity Checks**:
   - Verify row counts on critical tables: `User`, `StaffProfile`, `SalesOrder`, `Payment`, `StockLot`, `AuditEvent`.
   - Run `npx prisma db push --skip-generate` or `prisma validate` to confirm schema alignment.
   - Reconcile any Paystack payments processed between the backup timestamp and the incident via the Paystack Dashboard (`PaymentsService.verifyPayment` / `GET /api/payments/verify/:reference`).
4. **Quarterly Drill**: Test a full restore into an isolated staging database at least once per quarter and document recovery time.
