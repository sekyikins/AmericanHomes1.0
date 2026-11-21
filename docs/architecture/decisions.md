# Architecture Decision Records (TDD v1.0)

| ADR | Decision | Status |
| :--- | :--- | :--- |
| 001 | Modular monolith, not microservices | Recommended |
| 002 | PostgreSQL as source of truth | Recommended |
| 003 | Dedicated backend API; no direct browser writes to business tables | Recommended |
| 004 | Next.js + TypeScript frontend | Recommended |
| 005 | NestJS + TypeScript backend | Recommended |
| 006 | Inventory ledger + central stock commitment service | Required |
| 007 | Transactional outbox for external side effects | Recommended |
| 008 | Paystack adapter | Provisional |
| 009 | Managed OTP provider | Provisional |
| 010 | Private object storage (Supabase Storage) | Recommended |
| 011 | No Redis/microservices initially | Recommended |
