# AmericanHomes — Staff User Guide

## 1. Signing In & Managing Your Account
1. Open `/staff/login` and sign in with your staff email and password (and 6-digit MFA code if enabled).
2. Click your name in the top-right header to open your **Staff Account** modal:
   - **Account details**: View your profile or submit a profile-change request (requires manager/Owner approval).
   - **Change password**: Update your password independently (minimum 8 characters; automatically signs out other devices).
   - **Submit report / request**: Submit an internal workplace report or request. Check **Submit anonymously** if you want your identity recorded as `Anonymous`.

## 2. Shipments & Receiving (`/staff/shipments`, `/staff/receiving`)
1. Create a shipment (`PLANNED`), upload/enter its expected manifest items, and record tracking updates or shipment expenses.
2. Advance the shipment status through `IN_TRANSIT` -> `ARRIVED` when goods reach the Tema warehouse.
3. Start a **Receiving Session** (`/staff/receiving`) and record actual received quantities and condition per manifest line.
4. Any variance creates a **Discrepancy** and places received units into **Unavailable** stock pending onboarding.
5. Resolve all open discrepancies before closing the shipment.

## 3. Product Preparation, Pricing & Publishing (`/staff/preparation`, `/staff/products`)
1. Complete the sequential preparation steps in order: **Inspection -> Cleaning -> Photography -> Wrapping** (note any cosmetic/functional defects in `defectDisclosures`).
2. Propose a retail price on the variant; a second authorized manager (or the Owner) must approve the price before publication.
3. Publish the product to make it visible on the customer storefront (`/shop`).

## 4. Orders, Walk-In Sales, Reservations & Collections
- **Orders (`/staff/orders`)**: View both `ONLINE` and `WALK_IN` orders (use the Source filter/badges to distinguish them). Create walk-in sales directly from this page.
- **Reservations (`/staff/reservations`)**: Review pending customer reservations (`ONLINE` / `WALK_IN`) and approve (starts 48-hour payment hold) or decline.
- **Payments (`/staff/payments`)**: Record manual payments (Cash, MoMo, Bank Transfer) with reference/evidence. A different authorized approver (or Owner) must approve manual payments.
- **Collections (`/staff/collections`)**: Record warehouse pickups at order-line level, supporting both partial and full collections. Unpaid orders require Owner/management override.

## 5. Returns, Inventory, Reports & Requests
- **Returns (`/staff/returns`)**: Review customer return/exchange requests (7-day eligibility check), approve/decline, inspect returned items (`RESTOCK` vs `DISPOSE`), and issue refunds or **Store Credit**.
- **Inventory & Stocktakes (`/staff/inventory`, `/staff/stocktakes`)**: Monitor `Available`, `Held`, and `Unavailable` stock buckets; conduct stocktakes and submit adjustment proposals for approval.
- **Product Requests, Sourcing & Allocations (`/staff/product-requests`, `/staff/sourcing`, `/staff/allocations`)**: Group customer demand, link sourcing items to shipments, and issue 24-hour allocation offers when stock arrives.
- **Finance & Reports (`/staff/reports`, `/staff/expenses`)**: View financial summaries, estimated shipment profitability, and export `CSV`, `XLSX`, or `PDF` reports (subject to your entity permissions).
