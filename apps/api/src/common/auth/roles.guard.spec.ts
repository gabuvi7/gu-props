import { Logger, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { TenantRole } from "@gu-prop/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestContextService } from "../request-context/request-context.service";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

type ReflectorMock = {
  getAllAndOverride: ReturnType<typeof vi.fn>;
};

type RequestContextMock = {
  getOptional: ReturnType<typeof vi.fn>;
};

function createReflectorMock(): ReflectorMock {
  return {
    getAllAndOverride: vi.fn()
  };
}

function createContextServiceMock(
  context?: { tenantId: string; userId: string; role: TenantRole; requestId: string }
): RequestContextMock {
  return {
    getOptional: vi.fn().mockReturnValue(context)
  };
}

function createExecutionContext(handlerName = "changeStatus"): ExecutionContext {
  const handler = function changeStatus(): void {};
  Object.defineProperty(handler, "name", { value: handlerName });

  return {
    getHandler: () => handler,
    getClass: () => class FakeController {},
    switchToHttp: () => ({
      getRequest: () => ({ url: "/liquidations/abc", method: "PATCH" })
    })
  } as unknown as ExecutionContext;
}

function createGuard(reflector: ReflectorMock, ctx: RequestContextMock): RolesGuard {
  return new RolesGuard(reflector as unknown as Reflector, ctx as unknown as RequestContextService);
}

describe("RolesGuard (passive placeholder, REQ-013)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // El guard usa `new Logger(RolesGuard.name)`, que delega en el logger global de Nest.
    // Espiamos los métodos del prototype para capturar las llamadas sin acoplarse a la instancia.
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("permite si el handler no tiene metadata @RequiresRole", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctxService = createContextServiceMock();
    const guard = createGuard(reflector, ctxService);

    const result = guard.canActivate(createExecutionContext());

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      REQUIRES_ROLE_KEY,
      expect.any(Array)
    );
  });

  it("permite y loguea WARN si tiene metadata pero el contexto no tiene rol disponible", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"] as TenantRole[]);
    const ctxService = createContextServiceMock(undefined);
    const guard = createGuard(reflector, ctxService);

    const result = guard.canActivate(createExecutionContext());

    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const payload = warnSpy.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        enforcement: false,
        expectedRoles: ["ADMIN"],
        actualRole: undefined
      })
    );
  });

  it("permite pero loguea WARN si el rol del contexto NO está en la lista permitida", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(["OWNER", "ADMIN"] as TenantRole[]);
    const ctxService = createContextServiceMock({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "OPERATOR",
      requestId: "req-1"
    });
    const guard = createGuard(reflector, ctxService);

    const result = guard.canActivate(createExecutionContext("transitionToPaid"));

    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const payload = warnSpy.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        enforcement: false,
        expectedRoles: ["OWNER", "ADMIN"],
        actualRole: "OPERATOR",
        tenantId: "tenant-1",
        userId: "user-1",
        requestId: "req-1",
        endpoint: "transitionToPaid"
      })
    );
  });

  it("permite y loguea INFO si el rol del contexto SÍ está en la lista", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(["OWNER", "ADMIN"] as TenantRole[]);
    const ctxService = createContextServiceMock({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "ADMIN",
      requestId: "req-1"
    });
    const guard = createGuard(reflector, ctxService);

    const result = guard.canActivate(createExecutionContext());

    expect(result).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    const payload = logSpy.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        enforcement: false,
        expectedRoles: ["OWNER", "ADMIN"],
        actualRole: "ADMIN"
      })
    );
  });

  it.skip("[US-007] cuando enforcement: true, rechaza con ForbiddenException 'No tenés permisos para realizar esta acción.'", () => {
    // Pendiente de habilitarse cuando US-007 active el switch.
    // Este placeholder documenta el comportamiento esperado.
  });
});
