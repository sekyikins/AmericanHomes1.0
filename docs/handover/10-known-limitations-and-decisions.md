# AmericanHomes — Known Limitations & Unresolved Business Decisions Register

## 1. Known Technical & Operational Limitations
1. **OTP / SMS Provider (Arkesel)**: `OtpService` currently operates in dummy mode (`'123456'`) when `OTP_API_KEY` is unset or a placeholder. Live SMS dispatch requires configuring valid `OTP_PROVIDER_URL` + `OTP_API_KEY` and adding the provider HTTP call in `OtpService.sendOtp`.
2. **WhatsApp Business Outbox**: `OutboxProcessor` logs `NotificationDeliveryAttempt` records, while `WhatsAppService` remains a stub until live Meta/WhatsApp Cloud API credentials (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_WEBHOOK_SECRET`) are provisioned.
3. **Paystack Live Settlement**: Paystack integration is verified with HMAC-SHA512 signed webhook payloads and `verifyPayment` settlement logic; live GHS settlement requires production Paystack keys and HTTPS webhook registration.
4. **API Security Hardening (Pre-Production)**: `apps/api/src/main.ts` does not yet apply `helmet` headers or `@nestjs/throttler` rate limiting on OTP/login endpoints, and `/api/docs` (Swagger) is enabled unconditionally.
5. **Local Browser Session Storage**: Customer and staff JWT tokens are stored in browser `sessionStorage` (`ah_token`) rather than `HttpOnly` cookies (mitigated by 12h TTL and `sessionVersion` server revocation).
6. **Prisma Windows Client Lock**: On Windows, `npx prisma generate` can encounter `EPERM` renaming `query_engine-windows.dll.node` if another Node process holds the DLL; build/deploy should run `prisma generate` on Linux CI/production containers or when no Node server is running.

---

## 2. Unresolved Business Decisions (`SRS §16`, `OD-01`–`OD-32`)
The following policy thresholds have **working configurable defaults** in `SystemSetting` (`/staff/settings`) and services, and require final Owner sign-off before Go-Live:

| Ref | Decision Topic | Current Default / Behavior | Owner Action Required |
| :--- | :--- | :--- | :--- |
| **OD-02** | Product Request withdrawal cutoff | Free withdrawal until `ShipmentSourcingItem` is provider-confirmed; thereafter escalates for management review | Confirm cutoff point |
| **OD-04** | Allocation offer acceptance window | `24 hours` before waitlist progression | Confirm duration |
| **OD-06** | Pending reservation hold duration | `2 hours` pending review; `48 hours` after approval (`ReservationExpiryJob`) | Confirm durations |
| **OD-12** | Manual payment evidence rules | Optional `reference` / `evidenceUrl` on `ManualPaymentDto` | Confirm if receipt photo/reference is mandatory |
| **OD-19** | Manager financial visibility scope | `restrictFinancials` flag per staff profile hides `reports.`, `expenses.`, `payments.view` | Confirm which managers should have `restrictFinancials = false` |
| **OD-20** | Store credit redemption & expiry | `StoreCreditEntry` issued on approved returns without automatic expiry | Confirm expiry policy & minimum order rules |
| **OD-26** | Authorised collection representative verification | Optional `representativeName` / `representativePhone` on `RecordCollectionDto` | Confirm ID/OTP verification policy for third-party pickup |
