# Staff Reports & Requests — Implementation Record

**Date:** 2026-11-21
**Status:** Implemented

## Overview

Staff Reports allows any authenticated staff member to submit internal operational, safety, HR, or system reports/requests from their Staff Account Modal, with an option for database-level anonymity. Viewing and acting (`ADDRESSED` / `DECLINED`) on submitted reports are strictly permission-gated, and only authorised staff members receive notifications when new reports are submitted.

## Database (`prisma/schema.prisma`)

Added `StaffReport` model:
- `id`: CUID primary key
- `title`, `category` (`GENERAL | OPERATIONS | SAFETY | HR | SYSTEM`), `description`
- `isAnonymous`: Boolean flag; when `true`, `reporterId` is stored as `null` and `reporterName` as `'Anonymous'`
- `status`: `'SUBMITTED' | 'ADDRESSED' | 'DECLINED'`
- `resolution`, `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt`

## Permissions

Added to `apps/api/src/common/constants/permissions.ts` and `apps/web/src/lib/permissionCatalog.ts`:
- `staff_reports.view` — View reports & requests
- `staff_reports.manage` — Act on reports & requests (Mark addressed / Decline)

(`staff_reports.manage` also grants view access via `PermissionsGuard` and `AdminShell`.)

## Backend API (`apps/api/src/modules/governance/`)

- `POST /governance/staff-reports` (`AuthGuard`, requires `role === 'STAFF'`): creates a `StaffReport`, records an `AuditEvent` (`actorId` omitted when `isAnonymous` is `true`), and notifies only active staff who hold `staff_reports.view`, `staff_reports.manage`, or `isOwner` (`NotificationsService.notifyActiveStaff(..., 'STAFF_REPORTS', ['staff_reports.view', 'staff_reports.manage'])`).
- `GET /governance/staff-reports` (`AuthGuard`, `PermissionsGuard`, `@RequirePermission('staff_reports.view')`): lists all reports and requests.
- `POST /governance/staff-reports/:id/act` (`AuthGuard`, `PermissionsGuard`, `@RequirePermission('staff_reports.manage')`): marks a report or request as `ADDRESSED` or `DECLINED` with optional resolution notes and logs an `AuditEvent`.

## Staff Portal UI

- **Staff Account Modal** (`apps/web/src/components/staff/StaffAccountModal.tsx`): opened by clicking the user chip in `AdminShell`; provides **Account details** (update staff name via `PATCH /users/me`) and **Submit Report** (with the **Submit anonymously** checkbox).
- **Staff Reports Page** (`apps/web/src/app/(staff-portal)/staff/staff-reports/page.tsx`): added to the **People & System** sidebar section in `AdminShell`, with status tabs, search, and permission-gated **Address** / **Decline** actions.
- **Strict Permission Enforcement**:
  - `AdminShell` restricts direct route navigation by permission (`Access restricted` fallback).
  - `NotificationsService.getMyNotifications` filters out staff notification types (`ORDERS`, `RESERVATIONS`, `REQUESTS`, `STAFF_REPORTS`) for which the staff member does not hold the corresponding permissions.
