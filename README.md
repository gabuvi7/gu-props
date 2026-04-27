# GU-Props

Base SaaS multi-tenant para gestión de alquileres inmobiliarios.

## Configuración local

Este repositorio usa un monorepo TypeScript con pnpm:

- `apps/api` — base backend con estilo NestJS.
- `apps/web` — base frontend con Next.js App Router.
- `packages/database` — schema Prisma y límite del cliente generado.
- `packages/shared` — enums, tipos y helpers de dinero compartidos.

Instalá dependencias solo cuando estés listo para ejecutar la app:

```bash
pnpm install
pnpm db:generate
pnpm test
```

## Advertencias de arquitectura

- El aislamiento por tenant es un requisito de producto, no un detalle de implementación. Las lecturas de negocio deben usar `id + tenantId`; NUNCA consultes una entidad de negocio solo por `id`.
- Los índices económicos son globales; valores custom por tenant, documentos, pagos, contratos, propietarios, inquilinos, propiedades, liquidaciones, movimientos de caja y logs de auditoría son tenant-scoped.
- Las páginas de App Router deben seguir siendo Server Components por defecto. Agregá `"use client"` solo en el límite interactivo más chico posible.
- La futura protección de rutas por auth va en `apps/web/proxy.ts`, no en `middleware.ts`.
- Los cálculos de dinero usan unidades menores enteras (`centavos`) en los helpers TypeScript para evitar errores de punto flotante.

## Slice actual

Este slice agrega la primera base real de backend: límite del cliente Prisma, `PrismaModule` de API, servicios/controladores funcionales para `Tenants`, `Owners`, `Renters`, `Properties` y `Contracts`, y tests unitarios que prueban que las operaciones tenant-scoped siempre incluyen el `tenantId` activo.

### Advertencia sobre contexto temporal de API

Hasta que exista auth con JWT, la API incluye un puente de contexto por request solo para desarrollo/testing que lee estos headers:

- `x-tenant-id` — obligatorio para operaciones tenant-scoped.
- `x-user-id` — opcional; si falta, se usa un usuario temporal de desarrollo.
- `x-role` — opcional; valores válidos: `OWNER`, `ADMIN`, `OPERATOR`, `READONLY`.
- `x-request-id` — opcional para trazabilidad.

Esto NO es autenticación productiva. Está deshabilitado intencionalmente con `NODE_ENV=production` y el header temporal `x-tenant-id` es solo para desarrollo/testing; JWT lo va a reemplazar antes de un deploy real.

Ejemplo de cuerpo para crear un propietario:

```json
{
  "displayName": "Ana Gómez",
  "email": "ana@example.com"
}
```

Ejemplo de cuerpo para crear un inquilino:

```json
{
  "displayName": "Juan Pérez",
  "identityNumber": "12345678"
}
```

Ejemplo de cuerpo para crear una propiedad:

```json
{
  "ownerId": "owner_123",
  "type": "APARTMENT",
  "addressLine": "Av. Siempre Viva 123",
  "city": "Rosario"
}
```

## Cómo probar manualmente

Levantá la API local y enviá siempre los headers temporales de contexto mientras no exista JWT. Reemplazá `tenant_123`, `owner_123`, `renter_123`, `property_123` y `contract_123` por IDs reales de tu base local.

Crear un contrato:

```bash
curl -X POST http://localhost:3000/contracts \
  -H "content-type: application/json" \
  -H "x-tenant-id: tenant_123" \
  -H "x-user-id: user_123" \
  -H "x-role: ADMIN" \
  -d '{
    "propertyId": "property_123",
    "ownerId": "owner_123",
    "renterId": "renter_123",
    "status": "DRAFT",
    "startsAt": "2026-05-01T00:00:00.000Z",
    "endsAt": "2027-04-30T00:00:00.000Z",
    "rentAmount": "100000.00",
    "currency": "ARS",
    "dueDayOfMonth": 10,
    "adjustmentIndexType": "ICL",
    "adjustmentPeriodMonths": 3,
    "nextAdjustmentAt": "2026-08-01T00:00:00.000Z"
  }'
```

Consultar contratos y contratos activos:

```bash
curl http://localhost:3000/contracts -H "x-tenant-id: tenant_123" -H "x-role: ADMIN"
curl http://localhost:3000/contracts/active -H "x-tenant-id: tenant_123" -H "x-role: ADMIN"
```

Consultar, actualizar y cambiar estado de un contrato:

```bash
curl http://localhost:3000/contracts/contract_123 -H "x-tenant-id: tenant_123" -H "x-role: ADMIN"

curl -X PATCH http://localhost:3000/contracts/contract_123 \
  -H "content-type: application/json" \
  -H "x-tenant-id: tenant_123" \
  -H "x-role: ADMIN" \
  -d '{ "rentAmount": "120000.00", "dueDayOfMonth": 5 }'

curl -X PATCH http://localhost:3000/contracts/contract_123/status \
  -H "content-type: application/json" \
  -H "x-tenant-id: tenant_123" \
  -H "x-role: ADMIN" \
  -d '{ "status": "ACTIVE" }'
```
