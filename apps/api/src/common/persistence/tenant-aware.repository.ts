import type { RequestContext } from "../request-context/request-context";
import type { RequestContextService } from "../request-context/request-context.service";

type Where = Record<string, unknown>;

export type TenantScopedRecord = Readonly<{
  id: string;
  tenantId: string;
}>;

export type TenantAwareDelegate<TRecord> = {
  findFirst(args: { where: Where }): Promise<TRecord | null>;
  findMany(args: { where: Where }): Promise<TRecord[]>;
  update?(args: { where: Where; data: Where }): Promise<TRecord>;
};

export class TenantAwareRepository<TRecord extends TenantScopedRecord> {
  constructor(
    private readonly delegate: TenantAwareDelegate<TRecord>,
    private readonly contextService: Pick<RequestContextService, "get">
  ) {}

  findById(id: string, context: Pick<RequestContext, "tenantId"> = this.contextService.get()): Promise<TRecord | null> {
    return this.delegate.findFirst({ where: { id, tenantId: context.tenantId } });
  }

  list(where: Where = {}, context: Pick<RequestContext, "tenantId"> = this.contextService.get()): Promise<TRecord[]> {
    return this.delegate.findMany({ where: { ...where, tenantId: context.tenantId } });
  }

  async updateById(
    id: string,
    data: Where,
    context: Pick<RequestContext, "tenantId"> = this.contextService.get()
  ): Promise<TRecord> {
    if (!this.delegate.update) {
      throw new Error("Delegate does not support update");
    }

    await this.ensureBelongsToTenant(id, context);
    return this.delegate.update({ where: { id, tenantId: context.tenantId }, data });
  }

  async ensureBelongsToTenant(id: string, context: Pick<RequestContext, "tenantId"> = this.contextService.get()): Promise<TRecord> {
    const record = await this.findById(id, context);
    if (!record) {
      throw new Error("Record not found for active tenant");
    }

    return record;
  }
}
