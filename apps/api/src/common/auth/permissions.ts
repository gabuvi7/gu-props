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

/** Roles disponibles, ordenados de mayor privilegio a menor. */
export const ALL_ROLES: readonly TenantRole[] = ["OWNER", "ADMIN", "OPERATOR", "READONLY"] as const;

/**
 * Matriz declarativa de permisos para Liquidaciones (US-025/US-026, REQ-013).
 *
 * Cada acción declara la lista de roles permitidos. El `RolesGuard` consume
 * esta matriz vía el decorador `@RequiresRole(...)` colocando metadata por
 * handler. En esta iteración el enforcement está apagado (placeholder
 * pasivo): el guard sólo loguea cuando un rol no alcanzaría.
 *
 * Esta matriz refleja la decisión aprobada en proposal/spec REQ-013.
 * El enforcement real se activa con US-007.
 */
export const LIQUIDATIONS_PERMISSIONS = {
  list: ALL_ROLES,
  read: ALL_ROLES,
  download: ALL_ROLES,
  preview: ["OWNER", "ADMIN", "OPERATOR"],
  create: ["OWNER", "ADMIN", "OPERATOR"],
  updateDraft: ["OWNER", "ADMIN", "OPERATOR"],
  transitionToIssued: ["OWNER", "ADMIN", "OPERATOR"],
  transitionToPaid: ["OWNER", "ADMIN"],
  transitionToVoided: ["OWNER", "ADMIN"],
  /**
   * Permiso del endpoint `PATCH /liquidations/:id/status`. El endpoint cubre
   * transiciones a ISSUED, PAID y VOIDED — la unión de los permisos
   * (OWNER, ADMIN, OPERATOR). El service valida internamente la transición y
   * el rol mínimo real (OPERATOR puede emitir, ADMIN/OWNER pueden marcar PAID
   * o VOIDED). Cuando US-007 active enforcement granular, se reemplaza por
   * un guard que mire el `body.status`.
   */
  changeStatus: ["OWNER", "ADMIN", "OPERATOR"],
  manualAdjustments: ["OWNER", "ADMIN"]
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;
