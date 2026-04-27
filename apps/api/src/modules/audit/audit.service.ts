import type { RequestContext } from "../../common/request-context/request-context";

export type AuditEntryInput = Readonly<{
  entityType: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}>;

export class AuditService {
  createEntry(context: RequestContext, input: AuditEntryInput) {
    return {
      tenantId: context.tenantId,
      userId: context.userId,
      requestId: context.requestId,
      ...input,
      createdAt: new Date()
    };
  }
}
