import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestContext } from "./request-context";

type HeaderValue = string | string[] | undefined;
type RequestHeaders = Record<string, HeaderValue>;

const tenantRoles = ["OWNER", "ADMIN", "OPERATOR", "READONLY"] as const;

function firstHeader(value: HeaderValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requiredHeader(headers: RequestHeaders, name: string, label: string): string {
  const value = firstHeader(headers[name]);
  if (!value?.trim()) {
    throw new InvalidRequestContextError(`Falta el header temporal ${label}.`);
  }

  return value.trim();
}

export class MissingTenantContextError extends Error {
  constructor() {
    super("Falta el tenant activo en el contexto de la solicitud.");
  }
}

export class InvalidRequestContextError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext {
    const context = this.storage.getStore();
    if (!context?.tenantId) {
      throw new MissingTenantContextError();
    }

    return context;
  }

  getOptional(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Puente TEMPORAL para desarrollo/testing: construye contexto desde headers.
   * Debe reemplazarse por JWT auth antes de producción real.
   */
  fromTemporaryHeaders(headers: RequestHeaders): RequestContext {
    if (process.env.NODE_ENV === "production") {
      throw new InvalidRequestContextError("El contexto temporal por headers no está habilitado en producción.");
    }

    const role = firstHeader(headers["x-role"])?.trim() ?? "OPERATOR";
    if (!tenantRoles.includes(role as RequestContext["role"])) {
      throw new InvalidRequestContextError("El rol temporal enviado no es válido.");
    }

    return {
      tenantId: requiredHeader(headers, "x-tenant-id", "x-tenant-id"),
      userId: firstHeader(headers["x-user-id"])?.trim() || "usuario-desarrollo",
      role: role as RequestContext["role"],
      requestId: firstHeader(headers["x-request-id"])?.trim() || randomUUID()
    };
  }
}
