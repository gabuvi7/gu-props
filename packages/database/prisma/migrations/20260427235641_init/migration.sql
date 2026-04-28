-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'READONLY');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'RENTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RentalContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EconomicIndexType" AS ENUM ('IPC', 'ICL', 'UVA', 'FIXED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERPAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INCOME', 'EXPENSE', 'ADJUSTMENT', 'COMMISSION', 'OWNER_PAYOUT');

-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'PAYMENT_RECEIPT', 'LIQUIDATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "customDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commercialName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "defaultCurrency" "Currency" NOT NULL DEFAULT 'ARS',
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 0,
    "operationalParameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_features" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "limits" JSONB,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "paymentDetails" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "identityNumber" TEXT,
    "guaranteeInfo" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "addressLine" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "commissionBps" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "status" "RentalContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "dueDayOfMonth" INTEGER NOT NULL,
    "adjustmentIndexType" "EconomicIndexType" NOT NULL,
    "adjustmentPeriodMonths" INTEGER NOT NULL,
    "nextAdjustmentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economic_indices" (
    "id" TEXT NOT NULL,
    "type" "EconomicIndexType" NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "economic_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_index_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "economicIndexId" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_index_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "dueAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL,
    "remainingDebt" DECIMAL(14,2) NOT NULL,
    "creditBalance" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "paidAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_customDomain_key" ON "tenants"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenant_users_tenantId_idx" ON "tenant_users"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_users_userId_idx" ON "tenant_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_id_tenantId_key" ON "tenant_users"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_settings_tenantId_idx" ON "tenant_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_id_tenantId_key" ON "tenant_settings"("id", "tenantId");

-- CreateIndex
CREATE INDEX "tenant_features_tenantId_idx" ON "tenant_features"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_features_id_tenantId_key" ON "tenant_features"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_features_tenantId_key_key" ON "tenant_features"("tenantId", "key");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_tenantId_idx" ON "tenant_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_tenantId_status_idx" ON "tenant_subscriptions"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscriptions_id_tenantId_key" ON "tenant_subscriptions"("id", "tenantId");

-- CreateIndex
CREATE INDEX "owners_tenantId_idx" ON "owners"("tenantId");

-- CreateIndex
CREATE INDEX "owners_tenantId_displayName_idx" ON "owners"("tenantId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "owners_id_tenantId_key" ON "owners"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "owners_tenantId_email_key" ON "owners"("tenantId", "email");

-- CreateIndex
CREATE INDEX "renters_tenantId_idx" ON "renters"("tenantId");

-- CreateIndex
CREATE INDEX "renters_tenantId_displayName_idx" ON "renters"("tenantId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "renters_id_tenantId_key" ON "renters"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "renters_tenantId_identityNumber_key" ON "renters"("tenantId", "identityNumber");

-- CreateIndex
CREATE INDEX "properties_tenantId_idx" ON "properties"("tenantId");

-- CreateIndex
CREATE INDEX "properties_tenantId_ownerId_idx" ON "properties"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "properties_tenantId_status_idx" ON "properties"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "properties_id_tenantId_key" ON "properties"("id", "tenantId");

-- CreateIndex
CREATE INDEX "rental_contracts_tenantId_idx" ON "rental_contracts"("tenantId");

-- CreateIndex
CREATE INDEX "rental_contracts_tenantId_propertyId_idx" ON "rental_contracts"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "rental_contracts_tenantId_ownerId_idx" ON "rental_contracts"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "rental_contracts_tenantId_renterId_idx" ON "rental_contracts"("tenantId", "renterId");

-- CreateIndex
CREATE INDEX "rental_contracts_tenantId_status_idx" ON "rental_contracts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_id_tenantId_key" ON "rental_contracts"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "economic_indices_type_name_key" ON "economic_indices"("type", "name");

-- CreateIndex
CREATE INDEX "custom_index_values_tenantId_idx" ON "custom_index_values"("tenantId");

-- CreateIndex
CREATE INDEX "custom_index_values_economicIndexId_idx" ON "custom_index_values"("economicIndexId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_index_values_id_tenantId_key" ON "custom_index_values"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_index_values_tenantId_economicIndexId_periodDate_key" ON "custom_index_values"("tenantId", "economicIndexId", "periodDate");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "payments_tenantId_contractId_idx" ON "payments"("tenantId", "contractId");

-- CreateIndex
CREATE INDEX "payments_tenantId_renterId_idx" ON "payments"("tenantId", "renterId");

-- CreateIndex
CREATE INDEX "payments_tenantId_status_idx" ON "payments"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_tenantId_key" ON "payments"("id", "tenantId");

-- CreateIndex
CREATE INDEX "cash_movements_tenantId_idx" ON "cash_movements"("tenantId");

-- CreateIndex
CREATE INDEX "cash_movements_tenantId_occurredAt_idx" ON "cash_movements"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "cash_movements_tenantId_paymentId_idx" ON "cash_movements"("tenantId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_id_tenantId_key" ON "cash_movements"("id", "tenantId");

-- CreateIndex
CREATE INDEX "liquidations_tenantId_idx" ON "liquidations"("tenantId");

-- CreateIndex
CREATE INDEX "liquidations_tenantId_status_idx" ON "liquidations"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "liquidations_id_tenantId_key" ON "liquidations"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidations_tenantId_ownerId_periodStart_periodEnd_key" ON "liquidations"("tenantId", "ownerId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

-- CreateIndex
CREATE INDEX "documents_tenantId_entityType_entityId_idx" ON "documents"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_id_tenantId_key" ON "documents"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_tenantId_storageKey_key" ON "documents"("tenantId", "storageKey");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_id_tenantId_key" ON "audit_logs"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renters" ADD CONSTRAINT "renters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerId_tenantId_fkey" FOREIGN KEY ("ownerId", "tenantId") REFERENCES "owners"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_propertyId_tenantId_fkey" FOREIGN KEY ("propertyId", "tenantId") REFERENCES "properties"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_ownerId_tenantId_fkey" FOREIGN KEY ("ownerId", "tenantId") REFERENCES "owners"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_renterId_tenantId_fkey" FOREIGN KEY ("renterId", "tenantId") REFERENCES "renters"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_index_values" ADD CONSTRAINT "custom_index_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_index_values" ADD CONSTRAINT "custom_index_values_economicIndexId_fkey" FOREIGN KEY ("economicIndexId") REFERENCES "economic_indices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_index_values" ADD CONSTRAINT "custom_index_values_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_tenantId_fkey" FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_renterId_tenantId_fkey" FOREIGN KEY ("renterId", "tenantId") REFERENCES "renters"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "payments"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_ownerId_tenantId_fkey" FOREIGN KEY ("ownerId", "tenantId") REFERENCES "owners"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
