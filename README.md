# AmericanHomes Business Platform

AmericanHomes is a Ghana-based storefront and operations platform for authentic furniture, appliances, and everyday essentials imported from the USA and inspected in Tema, Ghana.

## Architecture

This repository is a pnpm monorepo following the approved BRD, SRS, and TDD specifications:

| Workspace | Stack | Purpose |
| :--- | :--- | :--- |
| `apps/web` | Next.js 14 (App Router), React, TypeScript | Public storefront, customer account portal, and internal staff workspace |
| `apps/api` | NestJS, Prisma, PostgreSQL (Supabase) | Modular monolith REST API, RBAC, inventory ledger, outbox worker, and integrations |
| `packages/contracts` | TypeScript | Shared API contracts and domain DTO types |
| `packages/config` | TypeScript, ESLint, Prettier | Shared design tokens and tooling configuration |
| `prisma/` | Prisma + PostgreSQL | Canonical database schema, migrations, and seed script |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 11+
- PostgreSQL (Supabase or local instance)

### Setup

```bash
# 1. Copy environment templates
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client & apply migrations
pnpm db:generate
pnpm db:migrate

# 4. Run frontend and backend concurrently
pnpm dev
```

- Web app: `http://localhost:3000`
- API server: `http://localhost:3001/api`
- Swagger API docs: `http://localhost:3001/api/docs`

## Documentation

See the `docs/` directory for the BRD, SRS, System Architecture TDD, Database Design Document, and developer guides.
