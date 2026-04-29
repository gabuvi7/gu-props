import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TenantRole } from "@gu-prop/shared";
import { RequestContextService } from "../request-context/request-context.service";
import { hasMinimumRole } from "./permissions";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";

type RoleCheckLog = {
  event: "role_check";
  enforcement: false;
  endpoint: string;
  path?: string;
  method?: string;
  expectedRoles: TenantRole[];
  actualRole: TenantRole | undefined;
  tenantId?: string;
  userId?: string;
  requestId?: string;
};

/**
 * Placeholder pasivo del enforcement de roles (REQ-013).
 *
 * Comportamiento actual (`enforcement = false`):
 *  - Lee la metadata `@RequiresRole(...)` del handler/controller.
 *  - Si no hay metadata, deja pasar sin loguear.
 *  - Si hay metadata, lee el rol activo desde `RequestContextService`.
 *      - Si el rol cumple, loguea INFO con el resultado.
 *      - Si el rol NO cumple (o no hay contexto), loguea WARN y deja pasar igual.
 *
 * Cuando US-007 active el switch (`enforcement = true`), los requests con rol
 * insuficiente se rechazarán con `ForbiddenException` con mensaje:
 *   "No tenés permisos para realizar esta acción."
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Switch de enforcement. En esta iteración SIEMPRE es `false` (placeholder).
   * Cambiar a `true` queda fuera del alcance hasta US-007.
   */
  private readonly enforcement: boolean = false;

  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly contextService: RequestContextService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[] | undefined>(
      REQUIRES_ROLE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const requestContext = this.contextService.getOptional();
    const actualRole = requestContext?.role;

    const httpRequest = (() => {
      try {
        return context.switchToHttp().getRequest<{ url?: string; method?: string }>();
      } catch {
        return undefined;
      }
    })();

    const allowed =
      actualRole !== undefined &&
      requiredRoles.some((required) => hasMinimumRole(actualRole, required));

    const logPayload: RoleCheckLog = {
      event: "role_check",
      enforcement: false,
      endpoint: context.getHandler().name,
      path: httpRequest?.url,
      method: httpRequest?.method,
      expectedRoles: requiredRoles,
      actualRole,
      tenantId: requestContext?.tenantId,
      userId: requestContext?.userId,
      requestId: requestContext?.requestId
    };

    if (!allowed) {
      this.logger.warn(logPayload);
      if (this.enforcement) {
        throw new ForbiddenException("No tenés permisos para realizar esta acción.");
      }
      return true;
    }

    this.logger.log(logPayload);
    return true;
  }
}
