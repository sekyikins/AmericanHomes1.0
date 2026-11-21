# AmericanHomes — System Administration Guide

## 1. Owner & Staff Account Governance
- **Sole Owner Account (`isOwner: true`)**:
  - Has full access across all staff portal modules, financial metrics, permission management, and owner-exclusive actions (e.g., deactivating staff, managing permission groups).
  - The Owner account cannot be deactivated via `POST /api/staff/:id/deactivate`.
- **Creating Staff Accounts (`/staff/staff`)**:
  - Only staff with `staff.create` (or `staff.manage` / Owner) can create accounts.
  - Each staff member must have a unique email, phone number, strong password, and assigned Permission Group.
  - **Rule**: Staff members must use a separate personal phone number if they also create a Customer storefront account; staff phone numbers are blocked from customer OTP login.
- **Deactivating Staff**:
  - Deactivating a staff account sets `StaffProfile.isActive = false` and increments `User.sessionVersion`, immediately invalidating all active JWT sessions for that user.

## 2. Permission Groups & Atomic Permissions (`/staff/permissions`)
- Permissions are granular (e.g., `orders.view`, `orders.create_walk_in`, `orders.approve`, `payments.view`, `payments.record_manual`, `payments.approve_manual`, `payments.refund`, `staff_reports.view`, `staff_reports.manage`).
- `restrictFinancials = true` blocks access to financial prefixes (`reports.`, `expenses.`, `payments.view`) and redacts financial figures on `/staff/dashboard` even if a group includes those permissions (unless `isOwner` is true).
- **Dual-Control**: Non-owner staff cannot self-approve their own manual payments, price proposals, or stocktake adjustments (`403 Forbidden`).

## 3. Session Security & Password Management
- Staff can change their own password inside the **Staff Account Modal** (`StaffAccountModal`). Changing a password increments `sessionVersion` and issues a fresh session token for the active tab while revoking all other sessions.
- Profile detail changes (name, email, phone) for staff are submitted as change requests and require approval by an authorized manager/Owner (`staff.update`).
- Customer **Sign out of all other sessions** (`AccountSettingsModal` -> Security) increments `sessionVersion` and refreshes the current tab's token while invalidating all other devices.

## 4. Operational Settings (`/staff/settings`)
- Configure operational thresholds (`OD-01`–`OD-32` defaults such as hold durations, return window days, and shipping/logistics notes) in `/staff/settings` (`SystemSetting`).

## 5. Staff Reports & Audit Logs
- **Staff Reports (`/staff/staff-reports`)**: Staff submit workplace reports/requests via the account modal (with an optional **Anonymous** toggle). Only staff with `staff_reports.view` / `staff_reports.manage` are notified and can view/resolve reports.
- **Audit Logs (`/staff/audit-logs`)**: Append-only `AuditEvent` trail (`GET /api/audit`, requires `audit.view`). Cannot be modified or deleted through the API.
