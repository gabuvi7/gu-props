import { PrismaClient } from "@prisma/client";

export { PrismaClient };
export type {
  CashMovement,
  CashMovementType,
  Currency,
  EconomicIndexType,
  Owner,
  Payment,
  PaymentStatus,
  Prisma,
  Property,
  PropertyStatus,
  PropertyType,
  RentalContract,
  RentalContractStatus,
  Renter,
  Tenant,
  TenantSettings,
  TenantStatus
} from "@prisma/client";

export type PrismaCompatibleClient = PrismaClient;
