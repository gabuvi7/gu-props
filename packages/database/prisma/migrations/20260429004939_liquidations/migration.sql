/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,ownerId,periodStart,periodEnd,currency]` on the table `liquidations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LiquidationAdjustmentSign" AS ENUM ('CREDIT', 'DEBIT');

-- DropIndex
DROP INDEX "liquidations_tenantId_ownerId_periodStart_periodEnd_key";

-- AlterTable
ALTER TABLE "liquidations" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "legalIdentity" JSONB;

-- CreateTable
CREATE TABLE "liquidation_line_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "liquidationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL,
    "dueAmount" DECIMAL(14,2) NOT NULL,
    "liquidableAmount" DECIMAL(14,2) NOT NULL,
    "commissionBpsApplied" INTEGER NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidation_manual_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "liquidationId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sign" "LiquidationAdjustmentSign" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidation_manual_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidation_line_items_tenantId_idx" ON "liquidation_line_items"("tenantId");

-- CreateIndex
CREATE INDEX "liquidation_line_items_tenantId_liquidationId_idx" ON "liquidation_line_items"("tenantId", "liquidationId");

-- CreateIndex
CREATE INDEX "liquidation_line_items_tenantId_paymentId_idx" ON "liquidation_line_items"("tenantId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidation_line_items_id_tenantId_key" ON "liquidation_line_items"("id", "tenantId");

-- CreateIndex
CREATE INDEX "liquidation_manual_adjustments_tenantId_idx" ON "liquidation_manual_adjustments"("tenantId");

-- CreateIndex
CREATE INDEX "liquidation_manual_adjustments_tenantId_liquidationId_idx" ON "liquidation_manual_adjustments"("tenantId", "liquidationId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidation_manual_adjustments_id_tenantId_key" ON "liquidation_manual_adjustments"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidations_tenantId_ownerId_periodStart_periodEnd_currenc_key" ON "liquidations"("tenantId", "ownerId", "periodStart", "periodEnd", "currency");

-- CreateIndex
CREATE INDEX "payments_tenantId_paidAt_status_idx" ON "payments"("tenantId", "paidAt", "status");

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_line_items" ADD CONSTRAINT "liquidation_line_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_line_items" ADD CONSTRAINT "liquidation_line_items_liquidationId_fkey" FOREIGN KEY ("liquidationId") REFERENCES "liquidations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_line_items" ADD CONSTRAINT "liquidation_line_items_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "payments"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_manual_adjustments" ADD CONSTRAINT "liquidation_manual_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_manual_adjustments" ADD CONSTRAINT "liquidation_manual_adjustments_liquidationId_fkey" FOREIGN KEY ("liquidationId") REFERENCES "liquidations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_manual_adjustments" ADD CONSTRAINT "liquidation_manual_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
