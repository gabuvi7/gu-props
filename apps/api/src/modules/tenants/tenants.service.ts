import type { TenantStatus } from "@gu-prop/shared";

export type TenantSummary = Readonly<{ id: string; slug: string; name: string; status: TenantStatus }>;

export class TenantsService {
  resolveActiveTenant(tenant: TenantSummary): TenantSummary {
    if (tenant.status !== "ACTIVE") {
      throw new Error("Tenant is not active");
    }

    return tenant;
  }
}
