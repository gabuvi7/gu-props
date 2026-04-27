import { PrismaClient } from "@prisma/client";

export { PrismaClient };
export type { Currency, Owner, Prisma, Property, PropertyStatus, PropertyType, Renter, Tenant, TenantSettings, TenantStatus } from "@prisma/client";

export type PrismaCompatibleClient = PrismaClient;
