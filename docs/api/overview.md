# API Overview & Endpoint Reference

- **Base URL**: `http://localhost:3001/api`
- **Swagger UI**: `http://localhost:3001/api/docs`
- **Authentication**: `Authorization: Bearer <token>` (Customer session key: `ah_token`; Staff session key: `ah_staff_token`)
- **Pagination**: `?page=1&limit=20`
- **Error envelope**: `{ "error": true, "statusCode": 400, "message": "..." }`

---

## 1. Catalogue, Preparation, Media & Publishing (`/api/catalogue`)

| Method & Path | Access | Description |
| :--- | :--- | :--- |
| `GET /catalogue/products` | Public | List published storefront products (`isPublished = true`) with variants, ordered media (`position ASC`), and stock lot balances. |
| `GET /catalogue/products/:id` | Public | Fetch single product with variants, attributes, ordered media, preparation steps, `completedStageCount`, and `preparationStatus`. |
| `GET /catalogue/admin/products` | Staff (`catalogue.view`) | List all products (Draft and Published) with `completedStageCount` (`0..6`) and `preparationStatus` (`NOT_STARTED`, `IN_PROGRESS`, `PREPARED`). Reconciles unpublished product stock to `unavailable`. |
| `POST /catalogue/products` | Staff (`catalogue.manage`) | Create a new product draft (`Not Started`) with an initial variant (`priceCents: 0`), an initial `StockLot` (`available: 0, unavailable: initialQuantity`), and pending `ProductPreparationRecord` steps. |
| `PATCH /catalogue/products/:id` | Staff (`catalogue.manage`) | Update product metadata (name, category, brand, model, description, defect disclosures). |
| `POST /catalogue/products/:id/media` | Staff (`catalogue.manage`) | Append single (`url`) or batch (`urls`) media records to a product. |
| `PATCH /catalogue/products/:id/media` | Staff (`catalogue.manage`) | Atomically sync and reorder all product photos (`urls: string[]`). `position: 0` is stored as the **Product Face** (primary cover image). |
| `DELETE /catalogue/products/:id/media/:mediaId` | Staff (`catalogue.manage`) | Remove a specific product media record. |
| `POST /catalogue/products/:id/preparation` | Staff (`catalogue.manage`) | Complete or independently update a preparation step (`INSPECTION`, `CLEANING`, `PHOTOGRAPHY`, `WRAPPING`). Enforces sequential prerequisites while allowing any already-completed stage (`1..k`) to be updated independently. |
| `POST /catalogue/products/:id/preparation/revert` | Staff (`catalogue.manage`) | Undo from a specific step (`{ step }`) or reset all preparation (`{ resetAll: true }`). Moves `available` stock back to `unavailable` and unpublishes if previously published. |
| `POST /catalogue/variants/:variantId/price-proposals` | Staff (`catalogue.manage`) | Submit or update Stage 5 (`PRICING`) retail price proposal (`proposedPriceCents`, `reason`). Requires all 4 physical steps to be completed first. |
| `POST /catalogue/price-approvals/:id/approve` | Staff (`catalogue.approve_price`) | Approve a price proposal (prohibits self-approval for non-Owner staff). Automatically triggers `publishProduct` if all physical preparation steps are complete. |
| `POST /catalogue/products/:id/publish` | Staff (`catalogue.publish`) | Complete Stage 6 (`FINAL_REVIEW`), approve pending price proposals, transition `unavailable` stock lots to `available` (`ONBOARDING_COMPLETED_AVAILABLE`), and set `isPublished = true`. |
| `POST /catalogue/products/:id/unpublish` | Staff (`catalogue.publish`) | Unpublish a `Prepared` (`6/6`) product (`isPublished = false`), preserving all 6 completed preparation records while moving `available` stock to `unavailable` (`PRODUCT_UNPUBLISHED_WITHHELD`). |

---

## 2. Customer Wishlist / Saved Items (`/api/catalogue/wishlist`)

| Method & Path | Access | Description |
| :--- | :--- | :--- |
| `GET /catalogue/wishlist` | Authenticated Customer | Retrieve the customer's saved wishlist items hydrated with live product, variant, media, price, and stock availability data. |
| `POST /catalogue/wishlist/items` | Authenticated Customer | Save a product (`productId`, `variantId`, `priceAtSaveCents`, `addedAt`) to the customer's persistent wishlist. |
| `DELETE /catalogue/wishlist/items/:productId` | Authenticated Customer | Remove a product from the customer's persistent wishlist. |
| `POST /catalogue/wishlist/merge` | Authenticated Customer | Idempotently merge guest `localStorage` wishlist items into the authenticated customer's database wishlist upon sign-in (Union/Deduplicate strategy). |

---

## 3. Inventory, Stocktakes & Dual-Control Adjustments (`/api/inventory`, `/api/stocktakes`)

| Method & Path | Access | Description |
| :--- | :--- | :--- |
| `GET /inventory` | Staff (`inventory.view`) | List all fully `Prepared` (`6/6`) product variants with `physical`, `available`, `held`, `unavailable`, `isPublished`, `disposition`, and recent `AdjustmentProposal` records. |
| `GET /inventory/balance/:variantId` | Staff (`inventory.view`) | Get real-time `physical`, `available`, `held`, and `unavailable` unit balances for a variant. |
| `GET /inventory/movements/:variantId` | Staff (`inventory.view`) | List chronological `InventoryMovement` ledger entries for a variant. |
| `POST /inventory/commit` | Staff / Internal | Commit a `StockHold` against `available` stock. Rejects if the parent product is not published (`isPublished = false`) or not in a saleable disposition. |
| `POST /stocktakes/adjustments` | Staff (`inventory.adjust`) | Propose a stock quantity adjustment (`variantId`, `quantity`, `reason`). Dual-control requires approval from a second manager or Owner. |
| `POST /stocktakes/adjustments/:id/approve` | Staff (`inventory.approve_adjustment`) | Approve and apply a pending stock adjustment to the ledger (self-approval prohibited for non-Owner). |
| `POST /stocktakes/adjustments/:id/reject` | Staff (`inventory.approve_adjustment`) | Reject a pending stock adjustment with a reason. |


---

## Unified Operational Workflow & Predictive Demand Endpoints

### 1. Multi-Signal Predictive Shipment Demand & Floor-Aging Markdown Engine
- `GET /api/sourcing/recommendations` (Permissions: `sourcing.view` or `shipments.view`)
  - Combines **Storefront (`ONLINE`) + Walk-in (`WALK_IN`) sales velocity**, **Wishlist saves & unmet wishlist demand** (`max(0, wishlistCount - availableQty)`), **Active & Unfulfilled/Expired Reservations** (`ONLINE` + `WALK_IN`), **Approved/Open Customer Product Requests**, **Customer Poll YES votes**, **In-Transit Shipment Manifest quantities**, and **Return/Transit-Damage rate penalties** into a composite Demand Score (`0–100`) and recommended next-shipment quantity ($Q_i$).
  - Also returns `markdownCandidates` for slow-moving, high-stock floor items (`daysOnFloor >= 14`, `availableQuantity >= 3`, low 30-day velocity), recommending a `10%–15%` price markdown (`suggestedPriceCents`) and surfacing `wishlistWaiters` who will see a `"Price dropped by GHS X"` badge once the markdown is approved.

### 2. Shipment → Product Catalog → Landed Cost & Stage 5 Pricing Margin Integration
- `GET /api/catalogue/admin/products` & `POST /api/catalogue/admin/products` / `PATCH /api/catalogue/admin/products/:id`
  - Links each product to its originating `shipmentId` and resolves `shipmentReference`.
  - Computes per-unit **Unit Acquisition Cost (`unitAcquisitionCostCents`)** from the originating shipment manifest item (`unitCostCents`), **Allocated Freight, Duty & Clearing Cost (`allocatedFreightAndDutyCents`)** by distributing total `ShipmentExpense` across manifest units, and **Estimated Landed Cost (`estimatedLandedCostCents`)**.
  - Stage 5 (`Pricing`) of Product Preparation uses `estimatedLandedCostCents` to display live projected unit profit and gross margin % before price approval.
- `GET /api/reports/shipment-performance`
  - Calculates `acquisitionCostCents`, `expensesTotalCents`, `landedCostTotalCents`, `realizedRevenueCents` (from non-cancelled `OrderLine`s of the shipment's linked product variants), and `estimatedGrossMarginCents`.

### 3. Closed-Loop Reservation → Order & Allocation → Reservation StockHold Transfers
- `POST /api/reservations/:id/convert` (Authenticated customer for own reservation, or staff with `reservations.manage` / `orders.create`)
  - Atomically converts an `APPROVED`, `PENDING`, or `ACTIVE` reservation into a `SalesOrder` (`AH-ORD-XXXXXX`), **transfers the reservation's existing active `StockHold` (`sourceType: 'SALES_ORDER'`, `sourceId: order.id`)** without double-deducting `InventoryLot.availableQuantity`, and marks the reservation `FULFILLED`.
- `POST /api/allocations/:id/respond`
  - When `accept: true`, automatically creates an `APPROVED` 48-hour `Reservation` (`AH-RES-XXXXXX`) for the customer and transfers the active `ALLOCATION_OFFER` `StockHold` (`sourceType: 'RESERVATION'`, `sourceId: reservation.id`) so the customer or showroom staff can immediately convert it into a paid order.

### 4. Warehouse Collection Exit Gate Pass & Representative Verification
- `GET /api/collections` & `POST /api/collections/record`
  - Generates an official deterministic **`gatePassCode` (`AH-GP-YYYY-XXXXXX`)** for every collection record, includes full order line items and product titles/codes, and records `representativeName`, `representativePhone`, and `representativeOtpVerified` for third-party collector security verification at the warehouse gate.


---

## Industry-Standard Workflow Remediation & Missing Links

### 5. Hold Lifecycle, Collection Stock Consumption & Store Credit / Partial Payments
- **Checkout Hold Preservation & Overdue Allocation Expiry (`ReservationExpiryJob`)**:
  - Recording or verifying any payment (Paystack, Manual MoMo/Cash/Bank Transfer, or Store Credit) transitions `CheckoutSession.status` to `'COMPLETED'` so the 5-minute expiry cron never releases stock holds on paid or partially-paid orders.
  - Abandoned unpaid checkout sessions auto-expire after 15 minutes, release their `StockHold`, and mark the abandoned `SalesOrder` as `CANCELLED`.
  - Overdue `AllocationOffer`s (`status: 'PENDING', expiresAt < now`) auto-expire, release their `ALLOCATION_OFFER` `StockHold` back to `available` stock, and reset the parent `ProductRequest` to `RECEIVED`.
- **Physical Stock Consumption at Warehouse Gate (`CollectionsService.recordCollection` -> `InventoryService.consumeOrderQuantity`)**:
  - Paid/held items remain in `StockLot.held` and `StockLot.quantity` (Physical Stock) while awaiting pickup in the warehouse.
  - Recording partial or full collection at the warehouse gate calls `InventoryService.consumeOrderQuantity`, decrementing `StockLot.held` and `StockLot.quantity` by the exact collected quantity.
- **Online Layaway / Installment Payments & Store Credit Redemption**:
  - `POST /api/payments/initialize` supports partial installment payments (`amountCents <= remainingCents`) for customers splitting high-ticket orders across multiple MoMo transactions.
  - `GET /api/payments/store-credit/me`, `GET /api/payments/store-credit/customer/:customerId`, and `POST /api/payments/redeem-store-credit` allow customers and staff to apply active `StoreCreditEntry` balances toward any unpaid order balance.

### 6. Dual-Control Pricing Queue, FOB-Value Landed Cost, Serialized Units & Gate Release PIN
- **FOB-Value Proportional Landed Cost Allocation**:
  - `CatalogueService.getAllProductsAdmin` allocates `ShipmentExpense` across manifest items proportional to each line's **FOB Cost Share (`(unitCostCents * quantity) / totalManifestFobCents`)**, preventing low-cost accessories from absorbing the same port clearing/freight cost as high-value furniture.
- **Strict Dual-Control Pricing & Automated Wishlist / Poll Alerts**:
  - `GET /api/catalogue/price-approvals`, `POST /api/catalogue/price-approvals/:id/approve`, and `POST /api/catalogue/price-approvals/:id/reject` enforce dual-control pricing: proposing a price change on an already-published product keeps the current live price until manager approval.
  - Approving a price drop automatically sends `PROMOTIONS` notifications to all customers who saved the product in their Wishlist; publishing a product automatically notifies Wishlist savers and `YES` voters on matching Product Polls.
- **Serialized Unit Tracking (`TrackedUnit`) & Printable Showroom Floor Tags**:
  - `GET /api/catalogue/products/:id/units`, `POST /api/catalogue/products/:id/units`, and `PATCH /api/catalogue/units/:unitId` register individual appliance serial numbers and scratch-and-dent unit condition tags.
- **Receiving-to-Catalog Draft Onboarding & Inspected Restock Release**:
  - `POST /api/receiving/lines/:lineId/create-product-draft` creates a linked Product Draft, `ProductVariant`, and `StockLot` (`unavailable: receivedQty`) directly from an unlinked receiving line.
  - `POST /api/inventory/release-unavailable` releases inspected restock or returned lots (`unavailable` → `available`) on already-published products in one click.
- **6-Digit Customer Gate Release PIN (`POST /api/collections/orders/:orderId/send-release-pin` & `verify-release-pin`)**:
  - Sends a 6-digit release PIN to the customer's account/phone and verifies it before issuing the Warehouse Exit Gate Pass (`AH-GP-YYYY-XXXXXX`) to a representative or courier driver.


---

## GRA E-VAT Tax Invoicing & Stock/Payment Integrity Hardening

### 7. Ghana VAT Act 2025 (Act 1151) & GRA E-VAT Integration (`/api/tax/*`)
- **Gap-Free Sequential Numbering (`DocumentSequence`)**:
  - Orders now receive sequential references (`AH-ORD-YYYY-NNNNNN`) allocated inside the order creation transaction; tax invoices (`AH-INV-YYYY-NNNNNN`) and credit notes (`AH-CN-YYYY-NNNNNN`) use separate gap-free counters.
- **Tax Decomposition**:
  - Tax-inclusive retail prices are decomposed into `netCents` + `nhilCents` (2.5%) + `getFundCents` (2.5%) + `vatCents` (15%) (configurable via `TAX_NHIL_BPS`, `TAX_GETFUND_BPS`, `TAX_VAT_BPS`).
- **Endpoints**:
  - `GET /api/tax/config` (`payments.view`) — seller TIN/details, tax rates, and `LIVE` vs `SANDBOX` E-VAT mode.
  - `GET /api/tax/invoices` (`payments.view`) — list sequential tax invoices and credit notes.
  - `GET /api/tax/orders/:orderId` (order owner or staff) — fetch tax invoice(s) and credit notes for an order.
  - `POST /api/tax/orders/:orderId/issue` (`payments.view`) — issue (or retry) a tax invoice for a paid order with optional `customerTin`.
  - `POST /api/tax/invoices/:id/retry` (`payments.view`) — retry GRA E-VAT clearance on `PENDING`/`FAILED`/`SANDBOX` documents.
- **Automatic Lifecycle**:
  - Paying an order in full automatically issues a `TaxInvoice` and submits it to `EvatClient` (live when `GRA_EVAT_BASE_URL`, `GRA_EVAT_API_KEY`, and `GRA_EVAT_TIN` are configured; otherwise explicitly flagged `SANDBOX`).
  - Payment reversals, paid-order cancellations, refund/store-credit returns, and downgrade exchanges automatically issue a sequential `CREDIT_NOTE` referencing the original invoice.

### 8. Hold, Deposit, Cancellation, Exchange & Gate PIN Integrity Fixes
- **Verified-Payment-Only Hold Protection**: `PENDING` payments no longer lock `CheckoutSession` or prevent hold expiry.
- **Bounded Walk-In & Converted-Reservation Holds**: Unpaid walk-in and reservation-converted orders create a time-bound `CheckoutSession` (`WALK_IN_UNPAID_HOLD_HOURS`, default 24h) and auto-cancel if unpaid when the window lapses.
- **Minimum Initial Deposit**: Customer online partial payments enforce `MIN_DEPOSIT_PERCENT` (default 30%) on the first installment.
- **Cancellation Settlement**: Cancelling a paid order releases holds, queues original-channel refunds (or issues store credit if `refundMethod: 'STORE_CREDIT'`) minus optional `restockingFeeBps`, and issues a VAT credit note.
- **Exchange Price Difference**: Upgrade exchanges increment `SalesOrder.totalCents` and reopen `paymentStatus: 'PARTIALLY_PAID'`; downgrade exchanges issue store credit and a VAT credit note.
- **Hardened Collection Release PIN**: 6-digit PINs are generated with `crypto.randomInt`, stored salted+SHA-256 hashed with a 5-attempt lockout and single-use consumption, delivered via both in-app notification and WhatsApp outbox, and never returned in API responses.


---

## Phases 3–7: Quotations, POD/Warranty, Cashier Till Shifts, Suppliers/FX/CBM & Warehouse Bins

### 9. Unified Operations Hub (`/api/operations/*`)
- **Phase 3 — Quotations & Soft vs. Hard Holds**:
  - `GET /api/operations/quotes`, `POST /api/operations/quotes`, `POST /api/operations/quotes/:id/convert`, `POST /api/operations/quotes/:id/cancel`.
  - Quotations (`AH-QT-YYYY-NNNNNN`) are soft quotes with configurable deposit % and 14-day validity (auto-expired by `ReservationExpiryJob`). Converting a quote creates a sequential `SalesOrder` (`AH-ORD-YYYY-NNNNNN`) with a `HARD` `StockHold` and a 24-hour payment window.
- **Phase 4 — Proof of Delivery (POD) & Warranty / Service Tickets**:
  - `CollectionRecord` now stores first-class `fulfilmentMode`, `deliveryAddress`, `vehiclePlate`, `deliveredAt`, `podPhotoUrl`, and `podSignedBy`.
  - `POST /api/operations/collections/:id/pod` records delivery sign-off and activates `TrackedUnit.warrantyExpiresAt` from the delivery date.
  - `GET/POST /api/operations/service-tickets` and `PATCH /api/operations/service-tickets/:id` manage warranty claims, repairs, missing parts, and installations (`AH-SRV-YYYY-NNNNNN`).
- **Phase 5 — Cashier Till Shifts (Blind Close) & MoMo/Bank Reconciliation**:
  - `GET /api/operations/shifts`, `POST /api/operations/shifts/open`, `POST /api/operations/shifts/:id/close` (`AH-SHF-YYYY-NNNNNN`).
  - Cashiers enter their physical cash count blind; closing calculates `expectedCashCents`, `cashVarianceCents`, `expectedMomoCents`, `expectedPaystackCents`, and `expectedBankCents`.
- **Phase 6 — Suppliers, FX Rates, CBM Volume & Frozen Landed Cost / COGS**:
  - `GET/POST /api/operations/suppliers` manages overseas suppliers (`Supplier`).
  - `POST /api/operations/shipments/:id/freeze-landed-costs` converts manifest unit costs by `Shipment.fxRateToGhs`, allocates freight/port/haulage expenses by `ManifestItem.cbm` volume share and customs/duty/insurance by FOB value share, and freezes `StockLot.landedUnitCostCents` for COGS & inventory valuation (`ReportsService.getFinancialSummary().inventoryValuationCents`).
- **Phase 7 — Warehouse Bin Locations, Multi-Box Sets & Blind Cycle Counts**:
  - `PATCH /api/operations/lots/:lotId/location` assigns `binLocation` and `abcClass` (`A`/`B`/`C`) to a `StockLot`.
  - `Product.boxCount` tracks multi-box sets; `Stocktake.isBlind` hides `systemQty` and `difference` while a blind cycle count is `OPEN`.
