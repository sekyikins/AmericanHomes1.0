americanhomes/
│
├── apps/
│   │
│   ├── web/                         # Next.js frontend
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (storefront)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── shop/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── [productId]/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── request-product/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── cart/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── checkout/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── policies/
│   │   │   │   │       ├── returns/
│   │   │   │   │       └── collection/
│   │   │   │   │
│   │   │   ├── (authentication)/
│   │   │   │   ├── login/
│   │   │   │   ├── verify-otp/
│   │   │   │   └── auth-callback/
│   │   │   │
│   │   │   ├── (customer-account)/
│   │   │   │   └── account/
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── page.tsx
│   │   │   │       ├── profile/
│   │   │   │       ├── product-requests/
│   │   │   │       ├── reservations/
│   │   │   │       ├── orders/
│   │   │   │       ├── payments/
│   │   │   │       ├── collections/
│   │   │   │       └── notifications/
│   │   │   │
│   │   │   ├── (staff-portal)/
│   │   │   │   └── staff/
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── dashboard/
│   │   │   │       ├── shipments/
│   │   │   │       ├── receiving/
│   │   │   │       ├── products/
│   │   │   │       ├── inventory/
│   │   │   │       ├── stocktakes/
│   │   │   │       ├── product-requests/
│   │   │   │       ├── sourcing/
│   │   │   │       ├── allocations/
│   │   │   │       ├── reservations/
│   │   │   │       ├── orders/
│   │   │   │       ├── payments/
│   │   │   │       ├── collections/
│   │   │   │       ├── returns/
│   │   │   │       ├── expenses/
│   │   │   │       ├── reports/
│   │   │   │       ├── customers/
│   │   │   │       ├── staff/
│   │   │   │       ├── audit-logs/
│   │   │   │       └── settings/
│   │   │   │
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── not-found.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── storefront/
│   │   │   ├── customer/
│   │   │   └── staff/
│   │   │
│   │   ├── features/
│   │   │   ├── authentication/
│   │   │   ├── catalogue/
│   │   │   ├── product-requests/
│   │   │   ├── reservations/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── orders/
│   │   │   ├── inventory/
│   │   │   ├── shipments/
│   │   │   ├── receiving/
│   │   │   ├── payments/
│   │   │   ├── collections/
│   │   │   ├── returns/
│   │   │   └── notifications/
│   │   │
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── formatting/
│   │   │   └── utilities/
│   │   │
│   │   ├── providers/
│   │   ├── store/
│   │   └── types/
│   │
│   └── api/                         # NestJS backend
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   │
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   ├── filters/
│       │   │   ├── pipes/
│       │   │   ├── middleware/
│       │   │   ├── constants/
│       │   │   └── utils/
│       │   │
│       │   ├── config/
│       │   │   ├── app.config.ts
│       │   │   ├── database.config.ts
│       │   │   ├── auth.config.ts
│       │   │   ├── storage.config.ts
│       │   │   └── integrations.config.ts
│       │   │
│       │   ├── database/
│       │   │   ├── prisma.module.ts
│       │   │   └── prisma.service.ts
│       │   │
│       │   ├── modules/
│       │   │   ├── authentication/
│       │   │   ├── users/
│       │   │   ├── staff/
│       │   │   ├── permissions/
│       │   │   ├── customers/
│       │   │   ├── catalogue/
│       │   │   ├── shipments/
│       │   │   ├── receiving/
│       │   │   ├── inventory/
│       │   │   ├── stocktakes/
│       │   │   ├── product-requests/
│       │   │   ├── sourcing/
│       │   │   ├── allocations/
│       │   │   ├── reservations/
│       │   │   ├── orders/
│       │   │   ├── payments/
│       │   │   ├── collections/
│       │   │   ├── returns/
│       │   │   ├── expenses/
│       │   │   ├── reports/
│       │   │   ├── notifications/
│       │   │   ├── audit/
│       │   │   └── dashboard/
│       │   │
│       │   ├── integrations/
│       │   │   ├── otp/
│       │   │   ├── paystack/
│       │   │   ├── whatsapp/
│       │   │   └── storage/
│       │   │
│       │   ├── jobs/
│       │   │   ├── outbox/
│       │   │   └── scheduled/
│       │   │
│       │   └── health/
│       │
│       ├── test/
│       └── tsconfig.json
│
├── packages/
│   ├── contracts/                   # Shared API contracts
│   │   ├── src/
│   │   │   ├── authentication/
│   │   │   ├── customers/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── shipments/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   └── index.ts
│   │
│   └── config/                      # Shared development configuration
│       ├── eslint/
│       ├── typescript/
│       └── prettier/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── docs/
│   ├── requirements/
│   ├── architecture/
│   ├── database/
│   ├── api/
│   └── development/
│
├── infrastructure/
│   ├── deployment/
│   ├── monitoring/
│   └── scripts/
│
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
└── README.md

This is not supposed to exactly the files that should or shouldn't exist, but only show how the tree structure is intended to be like.
## This is the intended architecture, not a requirement to create every empty folder immediately.

## How the frontend is organised
The frontend has three main experiences:
# Customer storefront

Public shopping experience — no account required to browse.
- Homepage and catalogue
- Product details and variants
- Product requests
- Cart and checkout
- Policies and collection information

# Customer account

Authenticated customer experience.
- Profile
- Product request tracking
- Reservations
- Orders and payments
- Collection history
- Notifications

# Staff portal

Internal operations and management.
- Operational dashboard
- Shipment and receiving management
- Catalogue preparation and inventory
- Product requests and sourcing
- Sales and fulfilment
- Finance, reports and administration

The (storefront), (customer-account) and (staff-portal) folders are Next.js route groups. Their names help organise the application but do not appear in the URLs. For example, the staff dashboard route is /staff/dashboard, not /staff-portal/staff/dashboard.

## What each backend module is responsible for
Module -	Responsibility
Authentication -	Phone OTP, sessions and authentication
Users -	User identity and account management
Staff -	Staff accounts and management
Permissions -	Permission groups, access checks and overrides
Customers -	Customer profiles and history
Catalogue -	Products, variants, pricing and publication
Shipments -	Shipment planning, manifests and providers
Receiving -	Physical receipt and discrepancy recording
Inventory -	Stock balances, movements and commitments
Stocktakes -	Physical counts and adjustment approvals
Product Requests -	Customer product requests and review
Sourcing -	Shipment sourcing and supplier confirmation
Allocations -	Offers of physically received stock
Reservations -	Reservation requests, holds and approvals
Orders -	Sales orders and order lifecycle
Payments -	Payment records and verification
Collections -	Warehouse collection and partial collection
Returns -	Return reviews, refunds and exchanges
Expenses -	Shipment and general expenses
Reports -	Operational and financial reports
Notifications -	In-app and WhatsApp notifications
Audit -	Searchable records of sensitive actions
Dashboard -	Aggregated operational summaries

Important: These are business modules, not necessarily separate microservices. They will run as one modular NestJS application initially.


