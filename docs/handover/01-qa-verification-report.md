# AmericanHomes — QA & Implementation Verification Report

**Verification Date:** 21 November 2026  
**Scope:** Full-stack verification of `apps/api`, `apps/web`, `prisma/schema.prisma`, `packages/config`, and `packages/contracts`.

---

## 1. Implementation Verification Findings
- **Frontend Hydration & Gating (`apps/web`)**:
  - Zero `INITIAL_*` mock arrays remain in `apps/web/src/app`.
  - `AdminShell.tsx` enforces `user.role === 'STAFF'` and permission-gated sidebar/route rendering using `permissionCatalog.ts`.
  - `/checkout` surfaces `defectDisclosures` on cart items and blocks checkout submission until the customer explicitly checks the acknowledgement box.
- **Backend Security & Authorization (`apps/api`)**:
  - 20/24 controllers enforce `@UseGuards(AuthGuard, PermissionsGuard)` + `@RequirePermission(...)`.
  - `AuthenticationController`, `DashboardController`, `NotificationsController`, and `UsersController` enforce `AuthGuard` and strict user/staff/permission scoping.
  - `AuthGuard` validates HMAC-SHA256 signatures, 12h TTL, `StaffProfile.isActive`, and `User.sessionVersion`.
  - `NotificationsService.getDigitalReceipt` and `markRead` enforce ownership/staff checks (preventing IDOR).
  - `NotificationsService.updatePreferences` explicitly allowlists valid boolean preference fields (`DEF-011` resolved).
- **Database Schema & Concurrency (`prisma/schema.prisma`)**:
  - 62 Prisma models verified; `SalesOrder` uses 3 independent status dimensions (`orderStatus`, `paymentStatus`, `fulfilmentStatus`) plus `source` (`ONLINE` / `WALK_IN`).
  - `InventoryService.commitStock` uses `SELECT ... FOR UPDATE` inside `$transaction` to prevent overselling.

---

## 2. Automated Verification & Test Results

| Check | Command | Result | Coverage |
| :--- | :--- | :--- | :--- |
| **Monorepo Typecheck** | `pnpm -r typecheck` | **Passed (0 errors)** | `packages/config`, `packages/contracts`, `apps/api`, `apps/web` |
| **API Production Build** | `pnpm --filter @americanhomes/api build` | **Passed (`nest build`)** | Full NestJS compilation |
| **Web Production Build** | `pnpm --filter @americanhomes/web build` | **Passed (44 routes)** | All storefront, customer account, and staff portal routes |
| **Security & UI Invariants** | `node --test apps/api/test/phase1-security-invariants.spec.mjs apps/web/test/interactions.spec.mjs` | **12/12 Passed** | Password hashing, TOTP MFA, 12h JWT TTL/tampering, `PermissionsGuard`, `OwnerOnlyGuard`, 401 session expiry handling, accessible UI components |
| **Phase 2 Core Workflows E2E** | `node --test apps/api/test/phase2-workflows.spec.mjs` | **1/1 Passed** | Staff login rejection/success, customer signup + 403 RBAC block, shipment `PLANNED -> IN_TRANSIT -> ARRIVED -> CLOSED` with discrepancy gate, preparation step order + publication gate, product request withdrawal cutoff, and Paystack late-webhook `EXCEPTION` routing |
| **Phase 2 Extended Workflows E2E** | `node --test apps/api/test/phase2-e2e-coverage.spec.mjs` | **1/1 Passed** | Wrong OTP rejection, `revokeOtherSessions` + `staff-change-password` + `DELETE /staff/:id` `sessionVersion` invalidation (`401`), restricted staff `AUDIT` export `403`, real `.xlsx` (`UEsDB`) and `.pdf` (`JVBERi0`) exports, stocktake + count lines, concurrent last-unit checkout race (`201` + `409`), duplicate Paystack webhook idempotency, receipt IDOR (`403`), walk-in sale (`WALK_IN`), manual payment dual-control, partial collection (`PARTIALLY_COLLECTED -> COLLECTED`), return + `StoreCreditEntry`, and notification preferences + WhatsApp consent |
