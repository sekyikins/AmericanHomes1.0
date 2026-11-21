# Endpoint Authorization Matrix (Phase 1)

| Method & Path | Auth Required | Permitted Actor | Required Permission / Guard | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api`, `GET /api/health*` | No | Public | — | Health & status |
| `POST /api/auth/request-otp`, `verify-otp` | No | Public / Customer | — | Phone OTP flow |
| `POST /api/auth/staff-login` | No | Staff / Owner | Email + Password + MFA (if enabled) | Rejects missing/invalid credentials (`401`) |
| `POST /api/auth/staff-mfa/*`, `staff-change-password`, `GET /api/auth/me` | Yes | Authenticated User | `AuthGuard` | Staff-only for MFA/password change |
| `GET /api/catalogue/products`, `:id` | No | Public | — | Published products only |
| `POST/PATCH /api/catalogue/products*` | Yes | Staff / Owner | `catalogue.manage` | `403` for customers/unauthorized staff |
| `POST /api/catalogue/products/:id/publish`, `unpublish` | Yes | Manager / Owner | `catalogue.publish` | Enforces publication gates |
| `GET/POST /api/shipments*` | Yes | Staff / Owner | `shipments.view` / `shipments.manage` | `403` without permission |
| `GET/POST /api/receiving*` | Yes | Staff / Owner | `receiving.view` / `receiving.manage` | `403` without permission |
| `GET/POST/DELETE /api/inventory*` | Yes | Staff / Owner | `inventory.view` / `inventory.adjust` | `403` without permission |
| `GET/POST /api/stocktakes*` | Yes | Staff / Owner | `stocktakes.manage` | `403` without permission |
| `POST /api/product-requests`, `GET /api/product-requests/my` | Yes | Customer | `AuthGuard` | Customer scoped to own records |
| `GET /api/product-requests`, `PATCH :id/review` | Yes | Staff / Owner | `product_requests.view` / `product_requests.review` | `403` for customers |
| `GET /api/sourcing*`, `/api/allocations*` | Yes | Staff / Owner | `sourcing.manage` / `allocations.manage` | `403` for customers |
| `POST /api/reservations`, `GET /api/reservations/my` | Yes | Customer | `AuthGuard` | Customer scoped to own records |
| `GET /api/reservations`, `POST :id/approve`, `decline` | Yes | Staff / Owner | `reservations.view` / `reservations.approve` | `403` for customers |
| `GET /api/orders/my` | Yes | Customer | `AuthGuard` | Customer scoped to own orders |
| `GET /api/orders`, `:id`, `POST /walk-in`, `POST :id/cancel` | Yes | Staff / Owner | `orders.view` / `orders.create_walk_in` / `orders.approve` | `403` for customers |
| `POST /api/payments/initialize`, `GET /verify/:ref` | Yes | Customer / Staff | `AuthGuard` | Server-side verification |
| `POST /api/payments/manual`, `:id/approve`, `:id/reverse` | Yes | Staff / Owner | `payments.record_manual` / `approve_manual` / `refund` | Self-approval prohibited (`403`) |
| `POST /api/payments/webhook` | Signature | Paystack | HMAC-SHA512 (`x-paystack-signature`) | Idempotent |
| `GET/POST /api/collections*` | Yes | Staff / Owner | `collections.manage` | `403` for customers |
| `POST /api/returns` | Yes | Customer / Staff | `AuthGuard` | Customer/staff return submission |
| `GET /api/returns` | Yes | Staff / Owner | `returns.review` | `403` for customers |
| `GET/POST /api/expenses*` | Yes | Staff / Owner | `expenses.view` / `expenses.manage` | Blocked if `restrictFinancials=true` |
| `GET /api/reports*` | Yes | Staff / Owner | `reports.view` | Blocked if `restrictFinancials=true` |
| `GET /api/staff/dashboard/summary` | Yes | Staff / Owner | `AuthGuard` (`role === 'STAFF'`) | Financial fields masked if `restrictFinancials=true` |
| `GET/POST/PATCH/DELETE /api/staff*` | Yes | Manager / Owner | `staff.view` / `staff.manage` | Managers cannot modify Owner (`403`) |
| `GET/POST /api/permissions/groups*` | Yes | Owner / Admin | `permissions.manage` | `403` without permission |
| `GET /api/audit` | Yes | Authorised Staff / Owner | `audit.view` | Append-only |
| `GET /api/customers*` | Yes | Staff / Owner | `customers.view` | `403` for customers |
| `GET /api/notifications/my`, `PATCH :id/read` | Yes | Authenticated User | `AuthGuard` | Scoped to `user.id` |
