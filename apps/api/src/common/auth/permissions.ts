import type { TenantRole } from "@gu-prop/shared";

const roleRank: Record<TenantRole, number> = {
  READONLY: 0,
  OPERATOR: 1,
  ADMIN: 2,
  OWNER: 3
};

export function hasMinimumRole(currentRole: TenantRole, minimumRole: TenantRole): boolean {
  return roleRank[currentRole] >= roleRank[minimumRole];
}

export function assertMinimumRole(currentRole: TenantRole, minimumRole: TenantRole): void {
  if (!hasMinimumRole(currentRole, minimumRole)) {
    throw new Error(`Role ${currentRole} cannot perform action requiring ${minimumRole}`);
  }
}
