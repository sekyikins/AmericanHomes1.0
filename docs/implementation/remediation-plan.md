# Remediation Plan (Phase 0)

Execution proceeds automatically across four sequential phases without pausing between phases.

## Phase 1 — Security, Database Schema & Core Invariants
1. **Authentication & RBAC (`ISS-001`, `ISS-002`, `ADD-001`, `ADD-002`)**:
   - Add `passwordHash`, `mfaSecret`/`mfaEnabled`, `isOwner`, `restrictFinancials` to `User`/`StaffProfile` in `prisma/schema.prisma`.
   - Enforce `12h` max session TTL in `token.ts` + `AuthGuard`.
   - Require email + password for `POST /auth/staff-login`, plus MFA/TOTP (or step-up OTP verification) for Owner & Manager accounts.
   - Apply `@UseGuards(AuthGuard, PermissionsGuard)` + `@RequirePermission(...)` to all staff/admin endpoints; enforce `OwnerOnlyGuard` on owner-exclusive actions and `restrictFinancials` checks on financial/report endpoints.
   - Enforce Manager cannot modify Owner (`403 Forbidden`).
2. **Schema Alignment & Migration Safeguards (`ISS-006`–`ISS-011`, `ISS-014`–`ISS-016`)**:
   - Split `SalesOrder` into `orderStatus`, `paymentStatus`, `fulfilmentStatus` (preserving existing `status` data via safe backfill).
   - Add `unavailable` bucket to `StockLot`, `TrackedUnit` model, `Product` (`brand`, `model`, `specifications`, `condition`, `disposition`, `defectDisclosures`, `shipmentId`, `unpublishReason`), `ProductPreparationRecord`, `PricingApproval` (`previousPriceCents`, `reason`, `comparableRef`), `ProductRequest` (`productName`, `category`, `quantity`, `imageUrl`, `referenceUrl`, `priority`, `providerConfirmedAt`, `withdrawnAt`), `CheckoutSession`, `Payment` (`payerName`, `payerPhone`, `evidenceUrl`, `isException`, `exceptionReason`), `CollectionRecord` (`representativeName`, `representativeOtpVerified`, `approvedBy`), `ReturnRequest` (`firstCollectedAt`, `settlementType`, `refundAmountCents`, `exchangeVariantId`, `priceDiffCents`), `StoreCreditEntry`, `NotificationPreference`, `NotificationDeliveryAttempt`, `ConsentEvent`, `Announcement`, `ProductPoll`, `PollVote`.
   - Generate non-destructive Prisma migration SQL with explicit backfills and rollback notes.
3. **Core Integrity & Expiry (`ISS-003`)**:
   - Fix `ReservationExpiryJob` to atomically expire overdue `PENDING` & `APPROVED` reservations AND release linked `StockHold`s via `InventoryService.releaseHold()`, plus expire overdue `CheckoutSession` holds and `AllocationOffer`s.
4. **Phase 1 Tests**: `node --test` unit & integration tests for password/MFA auth, RBAC negative checks, owner-only guards, self-approval rejection, and reservation/hold expiry concurrency.

## Phase 2 — Complete Backend Business Workflows
1. **Shipments & Receiving**: Tracking events, shipment expenses, manifest reconciliation, `Discrepancy` creation & resolution, `UNAVAILABLE` `StockLot` admission, closure blocked when unresolved discrepancies exist.
2. **Product Onboarding & Catalogue**: Variants & multi-attribute filtering (no double-counting), preparation sequence (`INSPECTION -> CLEANING -> PHOTOGRAPHY -> WRAPPING`), condition/disposition separation, defect disclosure, `PricingApproval` workflow + price history, strict `publishProduct` gate, `StorageService` upload/signed-URL controller.
3. **Inventory & Stocktakes**: `TrackedUnit` support, `StocktakeLine` counting + variance calculation, `AdjustmentProposal` submit/approve/reject with configurable threshold & self-approval block.
4. **Product Requests, Sourcing & Allocations**: Unified requests, `RequestGroup`, `ShipmentSourcingItem`, `providerConfirmedAt` cutoff enforcement, `AllocationOffer` 24h expiry + auto-waitlist progression + auditable priority.
5. **Reservations, Checkout, Orders, Payments, Collections & Returns**: Server-side `POST /orders/checkout` (15m hold + `SalesOrder` + `Payment` + Paystack init), late-payment exception queue, `CollectionLine` partial collection + unpaid-balance manager exception + rep OTP/approval verification, `ReturnRequest` 7-day from first collection + disclosed-defect check + inspection/disposition + refund/exchange/store-credit settlement.
6. **Finance, Reports, Notifications & Supporting Modules**: Shipment profitability (with incomplete-cost estimate labels), CSV/XLSX/PDF exports + export audit, `OperationalIncident`, `Announcement`, `ProductPoll`, `NotificationPreference` + `ConsentEvent`, digital receipts.
7. **Phase 2 Tests**: Automated tests covering all critical state transitions, financial invariants, and `SRS §14.2` scenarios.

## Phase 3 — Shared Contracts & Full Frontend Integration
1. Consolidate shared DTOs, enums, and response types in `@americanhomes/contracts`; consume in both `apps/api` and `apps/web`.
2. Fix all 7 contract mismatches and remove all `INITIAL_*` mock arrays and silent `catch {}` fallbacks across `(storefront)`, `(customer-account)`, and `(staff-portal)`.
3. Add permission-aware navigation & route protection in `AdminShell`, honest error/loading/empty/unavailable states, and wire remaining pages (`dashboard`, `shipments`, `receiving`, `preparation`, `inventory`, `stocktakes`, `sourcing`, `allocations`, `product-requests`, `expenses`, `reports`, `customers`, `audit-logs`, `notifications`, `announcements`, `incidents`, `settings`, `account/*`).

## Phase 4 — Final Verification & Completion Report
- Run full workspace `typecheck`, `build`, and all automated `node --test` suites; verify API endpoints end-to-end; produce final compliance & handover report.
