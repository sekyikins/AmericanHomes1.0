# Coding Conventions

## Backend Modules (`apps/api/src/modules/*`)
- Each business domain owns its controller, service, DTOs, and database mutations.
- Never directly mutate another module's tables; call its service or emit an outbox event.
- All inventory stock mutations MUST flow through `InventoryService`.
- Sensitive actions (approvals, price changes, manual payments, stock adjustments) MUST call `AuditService.record()` and prohibit self-approval.

## Naming
- Files: `kebab-case.ts`
- Classes & React Components: `PascalCase`
- Functions & variables: `camelCase`
- Financial values: stored as integer pesewas (`*Cents` / smallest currency unit).
