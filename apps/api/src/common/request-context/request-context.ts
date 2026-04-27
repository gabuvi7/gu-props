import type { TenantRole } from "@gu-prop/shared";

export type RequestContext = Readonly<{
  requestId: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
}>;
