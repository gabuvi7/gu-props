-- Sustituye el unique compuesto declarativo de Prisma por un índice único PARCIAL
-- que solo aplica a liquidaciones NO anuladas. Esto cumple REQ-006:
-- una liquidación VOIDED libera el slot para regenerar otra activa con el mismo
-- (tenantId, ownerId, periodStart, periodEnd, currency).
-- Prisma no puede expresar índices parciales en el schema declarativo, por eso
-- la migración se mantiene como SQL crudo y el comportamiento queda documentado
-- en `schema.prisma` (modelo `Liquidation`).

-- DropIndex
DROP INDEX "liquidations_tenantId_ownerId_periodStart_periodEnd_currenc_key";

-- CreateIndex (partial unique)
CREATE UNIQUE INDEX "liquidations_active_unique"
  ON "liquidations" ("tenantId", "ownerId", "periodStart", "periodEnd", "currency")
  WHERE status <> 'VOIDED';
