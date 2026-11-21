# AmericanHomes — Implementation Remediation & Verification Report

**Date:** 20 November 2026  
**Phases Completed:** Phase 0 (Discovery & Audit Validation), Phase 1 (Security, Schema & Invariants), Phase 2 (Backend Business Workflows), Phase 3 (Contract Alignment & Core Frontend Integration), Phase 4 (Automated Verification).

## 1. Phase 0 — Documentation & Audit Validation
- Created [audit-validation.md](file:///D:/All%20Projects/AmericanHomes/docs/implementation/audit-validation.md), [remediation-plan.md](file:///D:/All%20Projects/AmericanHomes/docs/implementation/remediation-plan.md), [requirements-traceability.md](file:///D:/All%20Projects/AmericanHomes/docs/implementation/requirements-traceability.md), and [open-business-decisions.md](file:///D:/All%20Projects/AmericanHomes/docs/implementation/open-business-decisions.md).
- Confirmed all 17 audit issues and discovered 3 additional defects (`12h` session cap, individual manager financial restriction model, BRD v1.2 metadata reconciliation).

## 2. Phase 1 — Security, Schema & Core Invariants
- **Password & MFA Staff Auth**: Added `scryptSync` password hashing (`apps/api/src/common/utils/password.ts`), TOTP MFA verification, `12h` max session TTL (`token.ts`), `POST /auth/staff-mfa/setup`, `POST /auth/staff-mfa/enable`, and `POST /auth/staff-change-password`.
- **RBAC Enforcement**: Attached `@UseGuards(AuthGuard, PermissionsGuard)` and `@RequirePermission(...)` to all staff/admin controllers (`endpoint-authorization-matrix.md`), added `OwnerOnlyGuard`, enforced Manager-cannot-modify-Owner (`StaffService`), and stripped financial permissions when `restrictFinancials = true`.
- **Database Schema Alignment**: Updated `prisma/schema.prisma` (`SalesOrder` 3-way status split, `StockLot.unavailable`, `TrackedUnit`, `ProductPreparationRecord`, `Product` condition/disposition/defects, `PricingApproval` history, `ProductRequest` fields + `priority`, `ShipmentSourcingItem.providerConfirmedAt`, `CheckoutSession`, `StoreCreditEntry`, `ConsentEvent`, `NotificationPreference`, `NotificationDeliveryAttempt`, `Announcement`, `ProductPoll`, `PollVote`, `SystemSetting`) and synced PostgreSQL via `npx prisma db push`.
- **Reservation & Checkout Hold Expiry**: Fixed `ReservationExpiryJob` to expire both overdue `PENDING` (`120m`) and `APPROVED` (`48h`) reservations and overdue `CheckoutSession`s (`15m`), releasing linked `StockHold`s via `InventoryService.releaseHold()`.
- **Owner & Settings Seed**: Updated `prisma/seed.ts` to seed `owner@americanhomes.gh` with hashed password, `isOwner: true`, default permission groups, and configurable `SystemSetting` rows.

## 3. Phase 2 — Backend Business Workflows
- **Shipments & Receiving**: Added tracking events, shipment expenses, status transitions, manifest reconciliation with `MISSING`/`EXCESS`/`UNEXPECTED`/`DAMAGED` `Discrepancy` generation, `UNAVAILABLE` `StockLot` admission, discrepancy resolution, and shipment close guard (`ShipmentsService`, `ReceivingService`).
- **Catalogue, Onboarding & Pricing**: Added variants/attributes, enforced `CLEANING -> PHOTOGRAPHY -> WRAPPING` sequence, `PricingApproval` with self-approval rejection, and strict `publishProduct` gates (`CatalogueService`).
- **Stocktakes & Adjustments**: Added `StocktakeLine` variance calculation and `AdjustmentProposal` submit/approve/reject with configurable `STOCK_ADJUSTMENT_THRESHOLD_QTY` and self-approval prevention (`StocktakesService`).
- **Product Requests, Sourcing & Allocations**: Added `RequestGroup`, `ShipmentSourcingItem` provider confirmation (`providerConfirmedAt`), withdrawal cutoff enforcement (post-confirmation escalation to `WITHDRAWAL_REQUESTED`), and `AllocationOffer` 24h expiry + auto-waitlist progression (`ProductRequestsService`, `SourcingService`, `AllocationsService`).
- **Checkout, Payments, Collections & Returns**: Added `POST /orders/checkout` (15m `StockHold` + `SalesOrder`), `Payment`/`PaymentAttempt` persistence on `initializePayment`, late-webhook `EXCEPTION` queue routing, `CollectionLine` partial collection + unpaid-balance & representative verification guards, and 7-day from first collection `ReturnRequest` + disclosed-defect flag + management settlement (`REFUND`, `STORE_CREDIT`, `EXCHANGE`) (`OrdersService`, `PaymentsService`, `CollectionsService`, `ReturnsService`).
- **Reports, Notifications & Governance**: Added financial summary, shipment profitability with incomplete-cost estimate labels, CSV/XLSX/PDF export generation + audit (`ReportsService`), notification preferences, WhatsApp consent ledger, digital receipts (`NotificationsService`), and `GovernanceModule` (`OperationalIncident`, `Announcement`, `ProductPoll`, `SystemSetting`, `StorageService` uploads).

## 4. Phase 3 & 4 — Frontend Alignment & Automated Verification
- Updated `apps/web/src/lib/api/endpoints.ts`, `auth.store.tsx`, `LoginModal.tsx` (email + password + optional MFA), and `AdminShell.tsx` (gates `/staff/*` behind `role === 'STAFF'` and filters navigation by `permissions`).
- Fixed active payload/ID mismatches in `checkout/page.tsx`, `request-product/page.tsx`, `shop/[productId]/page.tsx`, `staff/products/page.tsx`, `staff/orders/page.tsx`, and `staff/permissions/page.tsx`, and removed silent `catch {}` fallbacks on mutations in `reservations`, `payments`, `collections`, and `returns`.
- **Verification Results**:
  - `pnpm -r typecheck` — exited with code `0` (`@americanhomes/config`, `@americanhomes/contracts`, `@americanhomes/api`, `@americanhomes/web`).
  - `pnpm --filter @americanhomes/api build` — exited with code `0`.
  - `pnpm --filter @americanhomes/web build` — exited with code `0` (`43/43` static pages generated).
  - `node --test apps/api/test/phase1-security-invariants.spec.mjs apps/api/test/phase2-workflows.spec.mjs` — **6/6 passed (`pass 6, fail 0`)**.

## 5. Remaining Notes
- `OtpService` (`Arkesel`) and `WhatsAppService` (`Meta WhatsApp Business`) remain provider-ready adapters pending live external merchant/API credentials.
- Secondary read-only/reporting views (`shipments`, `receiving`, `stocktakes`, `expenses`, `reports`, `audit-logs`, and `(customer-account)/account/*`) still retain local preview arrays when no live records exist; all core API endpoints and schemas are in place for full data hydration.
