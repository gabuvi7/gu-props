# GU-Props

SaaS multi-tenant foundation for real-estate rental management.

## Local setup

This repository uses a pnpm TypeScript monorepo:

- `apps/api` — NestJS-style backend skeleton.
- `apps/web` — Next.js App Router frontend skeleton.
- `packages/database` — Prisma schema and generated client boundary.
- `packages/shared` — shared domain enums, types, and money helpers.

Install dependencies only when you are ready to run the app:

```bash
pnpm install
pnpm db:generate
pnpm test
```

## Architecture warnings

- Tenant isolation is a product requirement, not an implementation detail. Business reads must use `id + tenantId`; NEVER query a business entity by `id` alone.
- Economic indices are global; tenant custom index values, documents, payments, contracts, owners, renters, properties, liquidations, cash movements, and audit logs are tenant-scoped.
- App Router pages should remain Server Components by default. Add `"use client"` only at the smallest interactive boundary.
- Future auth route protection belongs in `apps/web/proxy.ts`, not `middleware.ts`.
- Money calculations use integer minor units (`cents`) in TypeScript helpers to avoid floating point drift.

## Current slice

This is the first foundation slice only: workspace setup, shared domain contracts, Prisma data model, backend tenant-context skeleton, web shell, and minimal Vitest examples for tenant-aware access and money/payment calculations.
