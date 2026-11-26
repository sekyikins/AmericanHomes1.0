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

---

## 6. Post-Baseline Workflow & UX Enhancements (November 2026)

1. **6-Stage Product Preparation, Automatic Publishing & Inventory Saleability State Machine**:
   - Unified preparation status derivation (`deriveCompletedStageCount` and `derivePreparationStatus` in `CatalogueService`) across all 6 stages (`INSPECTION`, `CLEANING`, `PHOTOGRAPHY`, `WRAPPING`, `PRICING`, `FINAL_REVIEW`). A product is marked `PREPARED` (`● Prepared`) **only** when all 6 stages are completed (`6/6`).
   - Added independent stage editing within the completed range (`Stage 1..k`), individual step undo (`POST /catalogue/products/:id/preparation/revert`), full preparation reset (`{ resetAll: true }`), and direct **Edit preparation** / **Restart preparation** actions in `ProductRecordModal`.
   - Dedicated product image uploading exclusively to Stage 3 (**Photography**): photos and removals are staged locally in React state (`photoDrafts`), staff select the **★ Product face** (primary cover image saved at `position: 0`), and changes are pushed atomically via `PATCH /catalogue/products/:id/media` when clicking **Complete Photography** / **Update Photography**. All product images render in the storefront PDP gallery (`/shop/[productId]`).
   - Enforced strict synchronization between `Prepared`, `Published`, and `Saleable`:
     - In-preparation (`< 6` stages) products remain in `/staff/preparation` with all unheld units in `Unavailable` (`Available = 0`) and are excluded from `/staff/inventory`.
     - Completing Stage 6 (`publishProduct`) approves pending price proposals, transitions `Unavailable` stock to `Available` (`ONBOARDING_COMPLETED_AVAILABLE`), marks `isPublished = true`, and removes the product from `/staff/preparation`.
     - Unpublishing a `Prepared` (`6/6`) product (`unpublishProduct`) preserves all 6 completed preparation steps (`● Prepared`) while moving `Available` stock to `Unavailable` (`PRODUCT_UNPUBLISHED_WITHHELD`) and displaying `● Unpublished` (never `● Saleable`) in `/staff/inventory`.
     - Enforced transaction-level publication checks in `InventoryService.commitStock()` and filtered walk-in order (`/staff/orders`) and reservation (`/staff/reservations`) variant selectors strictly to published, saleable variants (`isPublished && available > 0`).
2. **Customer Wishlist ("Saved Items") System (`WishlistProvider`, `/wishlist`, `/api/catalogue/wishlist*`)**:
   - Implemented a hybrid guest-to-account wishlist following Baymard Institute and NN/G UX best practices: zero-friction guest saving in `localStorage` (`ah_saved_products_v2` with automatic migration from legacy `ah_saved_products`) and database persistence (`SystemSetting` key `WISHLIST:<userId>`) for signed-in customers.
   - Automatic guest-to-account union/deduplicate merge (`POST /catalogue/wishlist/merge`) triggered immediately upon customer OTP sign-in.
   - Added live wishlist heart badge in `CustomerHeader`, heart toggle on `ProductCard` and `/shop/[productId]`, **Save for later** inside `BagModal`, **Saved items** stat card on `/account`, and a dedicated `/wishlist` page featuring real-time stock status, low-stock scarcity flags (`1..3` units), price-drop badges, **Move to bag** / **Move all available to bag**, and **Request similar item** fallback for out-of-stock items.
3. **Shipment Demand Suggestions, Lifecycle Notifications & Audit Completeness**:
   - `CreateShipmentView` automatically suggests approved customer product requests (`APPROVED_FOR_SOURCING` / `SOURCING`) for inclusion on new shipment manifests.
   - Automated customer notifications on request approval, shipment `IN_TRANSIT`, and `ARRIVED` / `READY_FOR_COLLECTION`.
   - Verified append-only `AuditEvent` recording across all staff and Owner actions, accompanied by confirmation toasts and `SearchableSelect` filterable combo dropdowns on all scalable entity selectors.
4. **Storefront & Mobile Navigation Polish**:
   - Horizontally scrollable single-row underline tabs in `AccountSettingsModal` with automatic active-tab scroll-into-view and form/tab state persistence across modal close/reopen.
   - `BackLink` and `NavigationHistoryTracker` (`sessionStorage` stack) ensuring `A -> B -> A` back navigation uses `router.back()` when returning to the previous route so native device back navigation never loops back to `B`.
   - Real-time unread notification dot synchronization (`ah:notifications-updated` event) and a top tab switcher (**Inventory ledger** | **Pending stock approvals**) on `/staff/inventory` and `/staff/stocktakes`.


---

## Unified Operational Workflow & Multi-Signal Demand Intelligence (Completed)

1. **Multi-Signal Predictive Shipment Demand & Floor-Aging Markdown Engine (`GET /api/sourcing/recommendations`)**:
   - Implemented in `SourcingService.getDemandRecommendations` and exposed via `SourcingController`.
   - Synthesizes Storefront (`ONLINE`) + Walk-in (`WALK_IN`) sales velocity, Wishlist saves & unmet demand (`max(0, wishlistCount - availableQty)`), Reservations (`ONLINE` + `WALK_IN` + unfulfilled/expired), Approved/Open Customer Requests, Customer Poll YES votes, In-Transit Shipment Manifest pipeline deductions, and Return/Damage rate penalties.
   - Surfaces actionable **Smart Manifest Recommendations** in `CreateShipmentView.tsx` (`/staff/shipments`) and **Predictive Demand & Floor Aging Intelligence** (with one-click sourcing batch prefill and one-click dual-control markdown price proposals) in `DemandWorkspace.tsx` (`/staff/sourcing`).
2. **Shipment → Product Catalog → Landed Cost & Stage 5 Pricing Margin Integration**:
   - Added per-item `unitCostCents` input (`Unit cost (GHS)`) on shipment manifest rows (`CreateShipmentView.tsx`, `staff/shipments/page.tsx`).
   - Linked `shipmentId` and resolved `shipmentReference`, `unitAcquisitionCostCents`, `allocatedFreightAndDutyCents`, and `estimatedLandedCostCents` in `CatalogueService.getAllProductsAdmin`.
   - Added the **Landed Cost & Gross Margin Calculator** card in Stage 5 (`Pricing`) of `/staff/preparation/page.tsx` and linked realized order revenue (`realizedRevenueCents`) and `estimatedGrossMarginCents` in `ReportsService.getShipmentPerformance`.
3. **Closed-Loop Allocation → Reservation → Order StockHold Transfers**:
   - Implemented `POST /api/reservations/:id/convert` (`ReservationsService.convertToOrder`) to convert a reservation into a `SalesOrder` while transferring the existing active `StockHold` directly to the order without double-deducting `availableQuantity`.
   - Wired `reservationsApi.convertToOrder` in both Staff Reservations (`ReservationModals.tsx` / `staff/reservations/page.tsx`) and Customer Reservations (`account/reservations/page.tsx`).
   - Updated `AllocationsService.respondToOffer` so accepting an allocation offer automatically creates an `APPROVED` 48-hour `Reservation` and transfers the `ALLOCATION_OFFER` `StockHold` to the reservation.
4. **Warehouse Collection Exit Gate Pass & Representative Verification**:
   - Added deterministic `gatePassCode` (`AH-GP-YYYY-XXXXXX`) and rich line-item details in `CollectionsService` (`findAll` and `recordCollection`).
   - Upgraded `CollectionDetailModal` (`CollectionModals.tsx` & `staff/collections/page.tsx`) into a printable **Warehouse Exit Gate Pass** with representative phone/OTP verification status and security gate checklist.


---

## Full Industry-Standard Audit Remediation (Completed)

1. **Checkout Session & StockHold Lifecycle Fix**:
   - Fixed `PaymentsService` (`recordManualPayment`, `approveManualPayment`, `settleVerifiedPayment`, `redeemStoreCredit`) to mark `CheckoutSession` as `'COMPLETED'` so `ReservationExpiryJob` never releases stock holds on paid or partially-paid orders.
   - Updated `ReservationExpiryJob` to auto-cancel abandoned unpaid orders on checkout hold expiry and auto-expire overdue `AllocationOffer`s (`ALLOCATION_OFFER` holds).
2. **Physical Inventory Consumption at Gate Collection**:
   - Implemented `InventoryService.consumeOrderQuantity` and wired it into `CollectionsService.recordCollection` so `StockLot.held` and `StockLot.quantity` (Physical Stock) are decremented as items leave the warehouse gate.
3. **Dual-Control Pricing Queue, FOB-Value Proportional Landed Cost & Automated Wishlist/Poll Alerts**:
   - Updated `CatalogueService.proposePrice` so live published storefront prices are only mutated after manager approval (`approvePrice`), added `rejectPrice` and `listPriceApprovals`, and surfaced the **Dual-Control Pricing Queue** in `/staff/products`.
   - Upgraded Landed Cost calculation to allocate `ShipmentExpense` proportional to **FOB Cost Share**.
   - Added automatic customer notifications on approved price drops (to Wishlist savers) and product publication (to Wishlist savers and Poll `YES` voters).
4. **Online Partial Installments, Store Credit Redemption, Return Exchanges & Inspection Restocking**:
   - Enabled partial online MoMo/Card installment payments in `PaymentsService.initializePayment` and `OrderPayBalanceModal`.
   - Added full Store Credit balance lookup and redemption (`GET /api/payments/store-credit/me`, `POST /api/payments/redeem-store-credit`).
   - Updated `ReturnsService.decide` so `RESTOCK` returns enter `StockLot.unavailable` for inspection first (releasable via `+ Release` in `StockWorkspace.tsx`), and `EXCHANGE` returns commit replacement stock and create an exchange `OrderLine` for gate collection.
5. **Serialized Unit Tagging (`TrackedUnit`), Receiving-to-Catalog Drafts, Showroom Floor Tags, & Gate Release PIN**:
   - Added `TrackedUnit` serial number and unit condition registration in Stage 1 Inspection (`/staff/preparation`) and a printable **Showroom Floor Tag / QR** modal.
   - Added `+ Catalog Draft` on unlinked receiving lines in `/staff/receiving` (`POST /api/receiving/lines/:lineId/create-product-draft`).
   - Added **6-Digit Customer Gate Release PIN** generation & verification, Fulfillment Mode (`SELF_COLLECTION`, `CUSTOMER_COURIER`, `WAREHOUSE_DISPATCH`), and Vehicle License Plate tracking on the Warehouse Exit Gate Pass in `/staff/collections`.
