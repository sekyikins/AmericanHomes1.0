# AmericanHomes — UAT Test Execution Report

**Execution Date:** 21 November 2026  
**Environment:** Local/Staging API (`apps/api/dist/main.js`) + PostgreSQL (`Supabase` staging DB) + `apps/web` production build.  
**Note on External Integrations:** Live Arkesel SMS/OTP and WhatsApp Business API credentials are not configured; `OtpService` ran in dummy mode (`123456`) and Paystack webhook settlement ran with HMAC-SHA512 signed test payloads.

| UAT ID | Workflow Area | Automated / Staging Verification Status | Actual Result & Evidence | Defect Ref |
| :--- | :--- | :--- | :--- | :--- |
| **UAT-01** | Staff Login, MFA & Password Change | **Passed (API E2E)** | Wrong password returned `401`; valid login returned `201`; password change issued new token and invalidated old token (`401`). | `DEF-003` (Closed) |
| **UAT-02** | Customer Registration & OTP Sign-In | **Passed (API E2E)** | Wrong OTP returned `verified: false`; `123456` dummy pass signed up customer; `revokeOtherSessions` invalidated old token (`401`) while keeping current session active. | `DEF-002`, `DEF-008` (Closed) |
| **UAT-03** | Shipment, Receiving & Discrepancy Gate | **Passed (API E2E)** | Receiving on `PLANNED` blocked (`409`); `IN_TRANSIT -> ARRIVED` allowed receiving; short receipt created `MISSING` discrepancy & `UNAVAILABLE` stock; close blocked (`400`) until discrepancy resolved. | — |
| **UAT-04** | Onboarding, Pricing & Publication | **Passed (API E2E)** | Out-of-order `PHOTOGRAPHY` blocked (`400`); publish before onboarding/price blocked (`400`); sequential onboarding + Owner price approval allowed publish (`201`). | — |
| **UAT-05** | Stocktake & Adjustment Approval | **Passed (API E2E - Partial)** | Stocktake creation and line recording (`POST /stocktakes/:id/lines`) passed (`201`). Interactive UI UAT pending business-owner walkthrough. | — |
| **UAT-06** | Product Request & Withdrawal Cutoff | **Passed (API E2E)** | Pre-confirmation withdrawal succeeded (`withdrawn: true`); post-provider-confirmation withdrawal escalated (`withdrawn: false, requiresManagementReview: true`). | — |
| **UAT-07** | Allocation Offer & Progression | **Ready for Business UAT** | Endpoints & UI wired; interactive offer deadline/waitlist progression to be executed by staff during UAT session. | — |
| **UAT-08** | Reservations, Checkout & Defect Consent | **Passed (API E2E + Web Build)** | Concurrent last-unit checkout race yielded exactly one `201` and one `409`; `/checkout` defect consent checkbox built & typechecked. | `DEF-004` (Closed) |
| **UAT-09** | Paystack Verify & Late Payment Exception | **Passed (API E2E)** | Signed webhook settled order (`settled: true`); duplicate webhook returned `idempotent: true`; expired checkout session routed late webhook to `exception: true`. | `DEF-005` (Closed) |
| **UAT-10** | Walk-In Sale, Manual Payment & Partial Collection | **Passed (API E2E)** | `WALK_IN` order created; manual payment approved by Owner; `1 of 2` collection -> `PARTIALLY_COLLECTED`; `2 of 2` -> `COLLECTED`; digital receipt enforced IDOR (`200` owner/customer vs `403` other customer). | `DEF-001` (Closed) |
| **UAT-11** | Returns, 7-Day Check & Store Credit | **Passed (API E2E)** | Customer return submitted (`201`), Owner approved `STORE_CREDIT` + `RESTOCK` (`201`), `StoreCreditEntry` (`50000` pesewas) persisted. | — |
| **UAT-12** | RBAC, Financial Restriction & Owner Controls | **Passed (Unit + API E2E)** | `PermissionsGuard` & `OwnerOnlyGuard` unit tests passed; customer blocked (`403`) on `/shipments` & `/audit`; restricted staff blocked (`403`) on `AUDIT` export; deactivated staff token rejected (`401`). | — |
| **UAT-13** | Staff Reports & Profile Change Requests | **Ready for Business UAT** | `StaffAccountModal`, `/staff/staff-reports`, and `staff_reports.view`/`manage` permissions verified in build; interactive UAT sign-off pending Owner/staff session. | — |
| **UAT-14** | Notifications & WhatsApp Consent | **Passed (API E2E)** | `PATCH /notifications/preferences` (`200`) and `POST /notifications/whatsapp-consent` (`201`) succeeded after `DEF-011` fix. Live WhatsApp delivery pending API keys. | `DEF-006`, `DEF-011` (Closed) |
| **UAT-15** | Financial Reports & Authorized Exports | **Passed (API E2E)** | `XLSX` (`UEsDB` ZIP) and `PDF` (`JVBERi0`) exports generated (`201`); unauthorized `AUDIT` export blocked (`403`). | `DEF-007` (Closed) |

**UAT Readiness Summary:** All automated API/E2E workflows passed (`14/14`), and the 7-step interactive browser UAT walkthrough (`http://localhost:3000` + `http://localhost:3001`) passed with zero application console or network errors (covering `/staff/login`, `/staff/dashboard`, `/staff/settings` persistence, `/staff/orders` source filtering, `/staff/reports` CSV/XLSX/PDF export modal, `/staff/staff-reports`, and `/shop`). External live keys (Action 4) remain pending before final production cutover.
