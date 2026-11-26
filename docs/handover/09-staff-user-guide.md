# AmericanHomes — Staff & Storefront Operations Guide

## 1. Signing In & Managing Your Staff Account
1. Open `/staff/login` and sign in with your staff email and password (and 6-digit MFA code if enabled). Upon sign-in, a welcome toast (`Welcome, <Name>`) confirms your session.
2. Click your name in the top-right header to open your **Staff Account** modal:
   - **Account details**: View your profile or submit a profile-change request (routed to `/staff/staff-reports` for manager/Owner approval).
   - **Change password**: Update your password independently (minimum 8 characters; increments `sessionVersion` to invalidate other active sessions).
   - **Submit report / request**: Submit an internal workplace report or request, optionally checking **Submit anonymously**.

---

## 2. Shipments, Demand Suggestions & Receiving (`/staff/shipments`, `/staff/receiving`)
1. **Create Shipment & Suggested Customer Requests**:
   - When creating a new shipment (`/staff/shipments`), the manifest builder automatically suggests approved customer product requests (`APPROVED_FOR_SOURCING` / `SOURCING`) so staff can include them with one click.
2. **Lifecycle & Automated Customer Notifications**:
   - **Approved**: When a customer's product request or reservation is approved, the customer receives an immediate notification.
   - **In Transit (`IN_TRANSIT`)**: Advancing a shipment to `IN_TRANSIT` automatically notifies customers whose linked requests/sourcing items are on that shipment.
   - **Ready for Collection (`ARRIVED` / `READY_FOR_COLLECTION`)**: When the shipment arrives or an order is marked ready for collection, the customer receives a collection notification.
3. **Receiving (`/staff/receiving`)**:
   - Open a **Receiving Session** to record received quantities and conditions per manifest line.
   - Any variance generates a **Discrepancy** (`MISSING`, `DAMAGED`, `UNEXPECTED`), and all open discrepancies must be resolved before closing the shipment.

---

## 3. Product Catalog, Preparation & Automatic Publishing (`/staff/products`, `/staff/preparation`)

### 3.1 Creating Product Drafts (`/staff/products`)
- After a shipment is received, create product drafts in **Product Catalog** (`/staff/products`) with their received unit quantity (`initialQuantity`).
- Newly created drafts start with:
  - **Preparation status**: `● Not Started` (`0 of 6` stages completed)
  - **Publication status**: `● Draft` (`isPublished = false`)
  - **Stock**: All received units placed in **`Unavailable`** onboarding stock (`Available = 0`).
- Note: Product images are **not** uploaded in the Product Record modal; image uploading is dedicated exclusively to Stage 3 (**Photography**) of Preparation.

### 3.2 The 6-Stage Preparation Workflow (`/staff/preparation`)
The **Preparation** page lists only products that have not yet completed all 6 preparation stages (`Not Started` or `In Progress`). Once a product completes all 6 stages and is published, it **automatically disappears** from the active Preparation page.

The 6 sequential stages are:
1. **Stage 1 — Inspection (`INSPECTION`)**: Record physical condition (`Excellent`, `Good`, `Minor cosmetic wear`), functional test result (`Passed`, `Passed with notes`, `Needs follow-up`), and inspection notes.
2. **Stage 2 — Cleaning (`CLEANING`)**: Record cleaning and surface preparation notes.
3. **Stage 3 — Photography (`PHOTOGRAPHY`)**:
   - Select multiple product photos (`Add product photos (multiple allowed)`).
   - Designate which image is the **★ Product face** (primary cover photo shown across cards and the storefront) by clicking the thumbnail or **Set as face**.
   - Selected photos and removals are staged locally in the browser and are **only uploaded and saved to the database when staff clicks `Complete Photography` (or `Update Photography`)**.
4. **Stage 4 — Wrapping (`WRAPPING`)**: Confirm protective wrapping and warehouse labelling.
5. **Stage 5 — Pricing (`PRICING`)**: Propose the retail selling price in GHS and pricing rationale.
6. **Stage 6 — Final Approval (`FINAL_REVIEW`)**: Click **Approve & Publish Product** to finalize preparation.

### 3.3 Independent Stage Updates & Reversing / Undoing Mistakes
- **Sequential Locking**: Future stages beyond the current frontier (`Stage > completedCount + 1`) remain locked until all preceding stages are completed.
- **Independent Updates Within Completed Range**: Any stage that has already been completed (`Stage 1..k`) can be clicked, edited, and saved independently to the database (**Update Inspection**, **Update Cleaning**, **Update Photography**, **Update Wrapping**, **Update Price Proposal**) without resetting later completed stages.
- **Undo & Restart Controls**:
  - **Undo `{Stage}`** / **Revert**: Reverts from the selected step onward and moves stock back to `Unavailable`.
  - **Restart all**: Resets all preparation steps back to `Not Started` (`0/6`).
  - From the **Product Catalog** modal, clicking a **`Prepared`** product provides **Edit preparation** (reopens Stage 6 and navigates directly to `/staff/preparation?productId=<id>`) and **Restart preparation**.

---

## 4. Relationship Between `Prepared`, `Published`, and `Saleable` (`/staff/inventory`)

| Lifecycle State | Product Catalog (`PREPARATION` / `PUBLICATION` / `AVAILABILITY`) | Preparation Page (`/staff/preparation`) | Inventory & Stocktakes (`/staff/inventory`) | Customer Storefront (`/shop`) |
| :--- | :--- | :--- | :--- | :--- |
| **1. In Preparation** (`0/6 .. 5/6` stages) | `● Not Started` or `● In Progress` · `● Draft` · `0 available` | **Listed** in active queue (`Unavailable stock = N`) | **Not listed** (still in onboarding) | Hidden |
| **2. Prepared & Published with Free Stock** (`6/6` stages, `Available > 0`) | `● Prepared` · `● Published` · `N available` | **Removed automatically** | **Listed** (`Available = N`, `Status = ● Saleable`) | **Live & Saleable** (all photos + face image) |
| **3. Prepared & Published, All Units Reserved** (`6/6` stages, `Available = 0, Held > 0`) | `● Prepared` · `● Published` · `0 available` | Not listed | **Listed** (`Available = 0, Held = H`, `Status = ● Hold`) | Live (shown as out of stock / reserved) |
| **4. Prepared, Manually Unpublished** (`6/6` stages, `Draft`) | `● Prepared` · `● Draft` · `0 available` | Not listed (unless *Edit/Restart preparation* is clicked) | **Listed** (`Available = 0, Unavailable = N`, `Status = ● Unpublished`) | Hidden & blocked from sale |

- **Pending Stock Approvals Shortcut**: On `/staff/inventory` and `/staff/stocktakes`, use the top tab bar (**Inventory ledger** | **Pending stock approvals**) or the top alert banner to jump directly to pending stock adjustment approvals without scrolling past long inventory tables.

---

## 5. Customer Wishlist ("Saved Items") (`/wishlist`)
- Customers (both guests and signed-in users) can click the heart icon (`♥`) on any storefront `ProductCard` or Product Detail Page (`/shop/[productId]`), or click **Save for later** inside their Shopping Bag (`BagModal`).
- **Guest-to-Account Silent Merge**: Guest wishlists are saved in `localStorage` (`ah_saved_products_v2`) without forcing a login prompt. When the customer signs in via OTP, their guest wishlist is automatically merged into their database wishlist (`POST /api/catalogue/wishlist/merge`).
- **Wishlist Workspace (`/wishlist`)**: Accessible from the header heart icon (with live count badge) and the Customer Account Overview (`/account`). Displays real-time warehouse stock, **Low stock** scarcity alerts (`1..3` units left), **Price drop** badges (comparing live price to price at save time), **Move to bag** / **Move all available to bag**, and a **Request similar item** fallback if an item sells out.


---

## 11. Unified Operational Workflows (Predictive Sourcing, Landed Cost Pricing, Hold Transfers & Gate Passes)

### 11.1 Predictive Shipment Demand & Floor-Aging Markdowns (`/staff/shipments` & `/staff/sourcing`)
- **Smart Manifest Recommendations in Create Shipment (`/staff/shipments`)**:
  - When creating a new shipment container, the **Smart Manifest Recommendations (Storefront + Walk-in Intelligence)** panel displays two actionable tabs:
    1. **Approved Customer Requests**: High-priority customer requests ready to be added to the manifest in one click.
    2. **Predicted High-Demand Restocks**: Catalog products ranked by the Multi-Signal Demand Score (combining online + walk-in sales velocity, unmet wishlist saves, online + walk-in reservations, customer requests, poll votes, in-transit pipeline deduction, and quality/damage penalty). Clicking a card adds the item, its recommended import quantity, and its previous unit cost directly to the manifest.
  - Each manifest row also includes a **Unit cost (GHS)** input so unit acquisition cost (FOB) is recorded at container creation.
- **Predictive Demand & Floor-Aging Markdowns in Sourcing (`/staff/sourcing`)**:
  - Displays both **Top Next-Shipment Restock Candidates** (with one-click `+ Source X units` to pre-fill a sourcing allocation batch) and **Floor-Aging & Dynamic Markdown Candidates** (slow-moving warehouse stock with a one-click `Propose -10%` or `Propose -15%` markdown button that submits a dual-control price change request and notifies wishlist savers with a `"Price dropped"` badge).

### 11.2 Shipment-to-Product Landed Cost & Stage 5 Gross Margin Calculator (`/staff/products` & `/staff/preparation`)
- **Shipment Attribution in Product Catalog (`/staff/products`)**:
  - Creating or editing a product links it to its originating shipment (`shipmentId`), displaying the real shipment reference (`SHP-...`) in the Product Catalog table.
- **Landed Cost & Gross Margin Calculator in Stage 5 Pricing (`/staff/preparation`)**:
  - During Stage 5 (**Pricing**), staff see a live breakdown of:
    - **Originating Shipment** (`SHP-...`)
    - **Unit Acquisition Cost (FOB)**
    - **Allocated Freight, Duty & Clearing per Unit**
    - **Estimated Landed Cost per Unit**
    - **Projected Gross Margin (`GHS X · Y%`)** dynamically recalculated as the selling price input changes, color-coded for healthy (`>= 20%`), thin (`> 0%`), or negative margin.

### 11.3 Closed-Loop Allocation → Reservation → Order Conversion (`/staff/reservations` & `/account/reservations`)
- **Allocation Acceptance → Automatic 48-Hour Approved Reservation**:
  - When a customer accepts an Allocation Offer for a sourced request, the system automatically creates an **APPROVED 48-hour Reservation** and transfers the `StockHold` from the allocation offer to the reservation.
- **Reservation → Sales Order Conversion (`Convert to order`)**:
  - Both staff (via the Reservation Review modal in `/staff/reservations`) and customers (via **Confirm & create order** in `/account/reservations`) convert an approved reservation into a `SalesOrder` via `POST /api/reservations/:id/convert`.
  - This transfers the reservation's existing `StockHold` directly to the new order without double-committing warehouse stock and marks the reservation `FULFILLED`.

### 11.4 Warehouse Exit Gate Pass & Representative Verification (`/staff/collections`)
- **Recording Handover**:
  - When a third-party representative collects on behalf of a customer, staff enter the collector's name, collector's phone number, and confirm **Representative identity & customer release OTP/call verified**.
- **Printable Warehouse Exit Gate Pass (`AH-GP-YYYY-XXXXXX`)**:
  - Clicking any completed collection row opens the official **Warehouse Exit Gate Pass** modal displaying the gate pass code (`AH-GP-YYYY-XXXXXX`), order & invoice numbers, item release manifest, collector & verification badge, and a **Security Gate Checklist**, with a **Print Gate Pass** action for physical gate release.
