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

This slice adds the first real backend foundation: Prisma client boundary, API `PrismaModule`, functional `Tenants` and `Owners` services/controllers, and unit tests proving owner operations always include the active `tenantId`.

### Temporary API context warning

Until JWT auth exists, the API includes a development/testing-only request-context bridge that reads these headers:

- `x-tenant-id` — obligatorio para operaciones tenant-scoped.
- `x-user-id` — opcional; si falta, se usa un usuario temporal de desarrollo.
- `x-role` — opcional; valores válidos: `OWNER`, `ADMIN`, `OPERATOR`, `READONLY`.
- `x-request-id` — opcional para trazabilidad.

This is NOT production auth. It is intentionally disabled in `NODE_ENV=production` and must be replaced by JWT-based authentication/authorization before a real deploy.

Example request body for creating an owner:

```json
{
  "displayName": "Ana Gómez",
  "email": "ana@example.com"
}
```
