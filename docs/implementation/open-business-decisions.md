# Open Business Decisions & Policy Register (Phase 0)

Tracks unresolved business decisions from `SRS §16` (`OD-01`–`OD-32`), `BRD §11`, and Directive `§4`, separating **Confirmed Rules** from **Provisional Configurable Defaults** and **Unresolved Policies**.

## 1. Confirmed Business Decisions (Implemented as Mandatory Rules)
- **Staff Auth & RBAC (`§4.1`)**: Email + password for all staff; stronger auth/MFA for Owner and Managers; 12-hour max session duration; no invented inactivity timeout; Managers can create ordinary staff accounts but cannot modify Owner; self-approval prohibited; individual manager financial visibility restrictions configurable by Owner.
- **Reservations & Checkout (`§4.2`)**: Pending reservation expiry `2h` (configurable); approved reservation window `48h` (configurable); direct checkout hold `15m` (configurable); late payment after hold expiry routed to management exception queue (never oversell or auto-refund).
- **Product Requests & Sourcing (`§4.3`)**: Unified workflow; no upfront payment; withdrawal allowed until **provider-confirmed purchase** (post-confirmation withdrawal requires management exception review); allocation offers expire in `24h` (configurable) with automatic progression to next eligible customer; chronological default ordering with auditable management priority override.
- **Store Credit (`§4.5`)**: Bound to customer, partially redeemable, non-transferable; **no expiry policy invented** until approved.
- **Collection & Fulfilment (`§4.6`)**: Warehouse collection only; representative verification via customer-phone OTP OR staff-recorded authorization with management approval; partial collection allowed even if unpaid (unpaid balance exceptions require management authorization).
- **Returns (`§4.7`)**: 7-day return window starting from **date of first collection**; every return settlement requires management approval; previously disclosed defects excluded from ordinary return eligibility.
- **Inventory & Onboarding (`§4.8`)**: Newly received goods enter `UNAVAILABLE`; available only after onboarding; configurable stock adjustment approval threshold (below threshold = single-step; at/above = manager approval); optional `TrackedUnit` for high-value products.

## 2. Unresolved Policy — Manual Payment Evidence (`§4.4`)
- **Fields**: Payment receipt/screenshot, payment channel, amount, payer's name or phone number.
- **Ambiguity**: The exact subset of mandatory vs. optional fields is not yet settled by the business owner.
- **Affected Components**: `ManualPaymentDto` (`apps/api/src/modules/payments/dto/manual-payment.dto.ts`), `PaymentsService.recordManualPayment`, `staff/payments/page.tsx`.
- **Implementation Approach**: Store all 4 fields (`evidenceUrl`, `method`/`channel`, `amountCents`, `payerName`, `payerPhone`) as structured columns/fields on `Payment`, isolate validation behind a configurable `PaymentEvidencePolicy` config object (`requireEvidence`, `requirePayerContact`, etc.), and avoid hardcoding an unapproved all-mandatory or single-field rule.
- **Recommended Policy**: Require `amountCents` + `method` + at least one of (`evidenceUrl` OR `reference`) + at least one of (`payerName` OR `payerPhone`) for Cash/MoMo/Bank Transfer, with staff override logged to `AuditEvent`.

## 3. Configurable Provisional Defaults (`SRS §16.1`)
| Setting | Config Key | Default | Notes |
| :--- | :--- | :--- | :--- |
| Pending reservation hold | `PENDING_RESERVATION_HOLD_MINUTES` | `120` (2h) | Configurable without code change |
| Approved reservation window | `APPROVED_RESERVATION_HOURS` | `48` | Configurable without code change |
| Checkout stock hold | `CHECKOUT_HOLD_MINUTES` | `15` | Configurable without code change |
| Allocation offer window | `ALLOCATION_OFFER_HOURS` | `24` | Configurable without code change |
| Stock adjustment auto-approve max | `STOCK_ADJUSTMENT_THRESHOLD_QTY` | `0` (all require approval) | Configurable per `§4.8.3–4` |
| Max session duration | `SESSION_MAX_HOURS` | `12` | Confirmed `§4.1.5` |

## 4. BRD v1.2 Metadata Reconciliation (`§3.2`)
- `docs/AmericanHomes_BRD_v1.2.docx` §14 records `Review Status: Business Owner Reviewed — Content Completeness Confirmed` and `Approval Signature: Pending`, while `docs/AmericanHomes_SRS_v1.0.docx` §1.6 and §17 explicitly establish that `BRD v1.2` was formally approved by Mr. Zero on 13 November 2026. Per Directive `§3.2`, `BRD v1.2` is treated as formally approved baseline.
