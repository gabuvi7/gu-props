export const tenantStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type TenantStatus = (typeof tenantStatuses)[number];

export const tenantRoles = ["OWNER", "ADMIN", "OPERATOR", "READONLY"] as const;
export type TenantRole = (typeof tenantRoles)[number];

export const propertyStatuses = ["AVAILABLE", "RENTED", "INACTIVE"] as const;
export type PropertyStatus = (typeof propertyStatuses)[number];

export const propertyTypes = ["APARTMENT", "HOUSE", "COMMERCIAL", "LAND", "OTHER"] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const rentalContractStatuses = ["DRAFT", "ACTIVE", "FINISHED", "CANCELLED"] as const;
export type RentalContractStatus = (typeof rentalContractStatuses)[number];

export const economicIndexTypes = ["IPC", "ICL", "UVA", "FIXED", "CUSTOM"] as const;
export type EconomicIndexType = (typeof economicIndexTypes)[number];

export const paymentStatuses = ["PENDING", "PARTIAL", "PAID", "OVERPAID", "VOIDED"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const cashMovementTypes = ["INCOME", "EXPENSE", "ADJUSTMENT", "COMMISSION", "OWNER_PAYOUT"] as const;
export type CashMovementType = (typeof cashMovementTypes)[number];

export const liquidationStatuses = ["DRAFT", "ISSUED", "PAID", "VOIDED"] as const;
export type LiquidationStatus = (typeof liquidationStatuses)[number];

export const documentTypes = ["CONTRACT", "PAYMENT_RECEIPT", "LIQUIDATION", "OTHER"] as const;
export type DocumentType = (typeof documentTypes)[number];

export const currencies = ["ARS", "USD"] as const;
export type Currency = (typeof currencies)[number];
