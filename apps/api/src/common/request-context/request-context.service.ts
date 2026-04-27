import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestContext } from "./request-context";

export class MissingTenantContextError extends Error {
  constructor() {
    super("Missing active tenant in request context");
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
}
