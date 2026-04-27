import { PrismaClient } from "@prisma/client";

export { PrismaClient };
export type {
  Currency,
  EconomicIndexType,
  Owner,
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
