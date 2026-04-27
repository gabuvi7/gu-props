import { TenantAwareRepository, type TenantScopedRecord } from "../../common/persistence/tenant-aware.repository";

export type OwnerRecord = TenantScopedRecord & { displayName: string; email?: string | null };

export class OwnersService {
  constructor(private readonly owners: TenantAwareRepository<OwnerRecord>) {}

  findOwnerForTenant(id: string) {
    return this.owners.findById(id);
  }
}
