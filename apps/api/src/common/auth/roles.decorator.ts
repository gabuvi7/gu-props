import { SetMetadata } from "@nestjs/common";
import type { TenantRole } from "@gu-prop/shared";

/**
 * Clave de metadata utilizada por `RolesGuard` para leer la lista de roles
 * requeridos por un handler/controller. Mantener este string estable: el guard
 * lo usa con `Reflector.getAllAndOverride`.
 */
export const REQUIRES_ROLE_KEY = "requires-role";

/**
 * Marca un endpoint (o controller entero) con la lista de roles permitidos.
 *
 * Hoy el enforcement está apagado (REQ-013, placeholder pasivo): si el rol
 * actual no alcanza, `RolesGuard` deja pasar pero loguea con
 * `enforcement: false`. Cuando US-007 active el switch, los requests con rol
 * insuficiente se rechazarán con `ForbiddenException`.
 *
 * @example
 *   @RequiresRole("OWNER", "ADMIN")
 *   @Patch(":id/status")
 *   async changeStatus() { ... }
 */
export const RequiresRole = (...roles: TenantRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_ROLE_KEY, roles);
