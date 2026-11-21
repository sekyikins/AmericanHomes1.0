# Audit Validation Report (Phase 0)

**Baseline Date:** 20 November 2026  
**Repository State:** Workspace `D:\All Projects\AmericanHomes` (not a `.git` repository). `pnpm -r typecheck` passes across all 4 packages (`@americanhomes/config`, `@americanhomes/contracts`, `@americanhomes/api`, `@americanhomes/web`); `0` automated test files exist.

## Issue Classification & Verification

| Audit ID | Classification | Verification Evidence |
| :--- | :--- | :--- |
| **ISS-001** | **Confirmed Defect (Critical)** | `PermissionsGuard` (`apps/api/src/common/guards/permissions.guard.ts`) and `@RequirePermission` are not attached to any controller in `apps/api/src/modules/*/*.controller.ts`. |
| **ISS-002** | **Confirmed Defect (Critical)** | `AuthenticationService.staffLogin` (`apps/api/src/modules/authentication/authentication.service.ts:53-68`) accepts only `{ email }` with no password hash, OTP, or MFA check. |
| **ISS-003** | **Confirmed Defect (Critical)** | `ReservationExpiryJob` (`apps/api/src/jobs/scheduled/reservation-expiry.job.ts:14-17`) sets `status = 'EXPIRED'` on overdue `APPROVED` reservations without releasing `StockHold` via `InventoryService.releaseHold()`, and ignores `PENDING` reservations. |
| **ISS-004** | **Confirmed Defect (Critical)** | `apps/web/src/app/(storefront)/checkout/page.tsx` does not create a server-side `CheckoutSession`, `SalesOrder`, or 15-minute `StockHold`; `PaymentsService.initializePayment` does not persist a `Payment`/`PaymentAttempt` row before Paystack redirect. |
| **ISS-005** | **Confirmed Defect (High)** | Multiple active mismatches: `request-product/page.tsx` vs `CreateRequestDto`, `staff/orders/page.tsx` vs `WalkInOrderDto`, `staff/products/page.tsx` vs `CreateProductDto`, `staff/collections` & `staff/returns` sending `reference` instead of `SalesOrder.id`, and `staff/permissions` permission code mismatch. |
| **ISS-006** | **Confirmed Defect (High)** | `CatalogueService.publishProduct` sets `isPublished: true` with zero checks; no variant/attribute endpoints, onboarding checklist, condition/disposition separation, defect disclosure acknowledgement, or `PricingApproval` workflow exist. |
| **ISS-007** | **Confirmed Defect (High)** | `ReceivingService.recordLine` inserts `ReceiptLine` without manifest reconciliation, `Discrepancy` generation, or `UNAVAILABLE` `StockLot` creation; `ShipmentsService.close` does not block closing with open discrepancies. |
| **ISS-008** | **Confirmed Defect (High)** | `StockLot` lacks an `unavailable` bucket (`prisma/schema.prisma:303-319`); `StocktakesService` lacks count lines, variance calculation, and `AdjustmentProposal` submit/approve/reject endpoints. |
| **ISS-009** | **Confirmed Defect (High)** | `ProductRequest` lacks `productName`, `category`, `quantity`, `imageUrl`, `referenceUrl`, `priority`; `SourcingService` & `AllocationsService` have `findAll()` only; no withdrawal cutoff (`providerConfirmedAt`) or auto-waitlist progression. |
| **ISS-010** | **Confirmed Defect (High)** | `SalesOrder.status` (`prisma/schema.prisma:495`) conflates order, payment, and fulfilment statuses into one field, violating `BR-074` and `FR-ORD-006`. |
| **ISS-011** | **Confirmed Defect (High)** | `CollectionsService` lacks `CollectionLine`s, partial collection tracking, unpaid-balance authorization, and representative OTP/staff-approval verification; `ReturnsService` lacks 7-day calculation from first collection, disclosed-defect exclusion, inspection, disposition, and refund/store-credit settlement. |
| **ISS-012** | **Confirmed Defect (High)** | Storefront catalogue/PDP, `(customer-account)/*`, and most `(staff-portal)/*` pages use hardcoded `INITIAL_*` mock arrays; `AdminShell` lacks role/permission gating; mutations swallow API errors silently. |
| **ISS-013** | **Confirmed Defect (High)** | `0` `.spec.ts` or `.test.*` files exist across `apps/api` and `apps/web`. |
| **ISS-014** | **Confirmed Defect (Medium)** | `OtpService` and `WhatsAppService` are console stubs; `NotificationPreference`, `NotificationDeliveryAttempt`, `ConsentEvent`, and digital receipt generation are missing. |
| **ISS-015** | **Confirmed Defect (Medium)** | `ReportsService` only lists `ExportJob`; no CSV/XLSX/PDF export generation, shipment profitability with incomplete-cost warnings, or export auditing; `AuditService` is omitted on most mutations. |
| **ISS-016** | **Confirmed Defect (Medium)** | `OperationalIncident` module, `Announcement`, `ProductPoll`/`PollVote`, `TrackedUnit`, and file-upload controller for `StorageService` are missing. |
| **ISS-017** | **Confirmed Defect (Medium)** | `@americanhomes/contracts` exists (`packages/contracts/src/*`) and typechecks, but neither `apps/api` nor `apps/web` imports from it. |
| **ADD-001** | **Additional Defect Discovered (High)** | `AuthenticationService` token issuance lacks a 12-hour max session cap (`exp` check in `token.ts`) and staff tokens lack MFA/step-up verification for Owner/Manager accounts (`§4.1.2`, `§4.1.5`). |
| **ADD-002** | **Additional Defect Discovered (Medium)** | `CustomerProfile` lacks individual manager financial-visibility restriction model (`§4.1.11`, `§4.5.2`: owner can restrict individual managers from financial data). |
| **ADD-003** | **Additional Defect Discovered (Low)** | `BRD v1.2 §14` shows `Approval Signature: Pending`, conflicting with `SRS v1.0 §1.6 & §17` which confirm formal business-owner approval (reconciled per Directive `§3.2`). |
