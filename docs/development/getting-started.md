# Getting Started

## Prerequisites
- Node.js 20+
- pnpm 11+
- PostgreSQL (Supabase or local instance)

## Setup
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

- Web app: `http://localhost:3000`
- API server: `http://localhost:3001/api`
- Swagger UI: `http://localhost:3001/api/docs`
