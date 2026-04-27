import { TenantAwareRepository, type TenantScopedRecord } from "../../common/persistence/tenant-aware.repository";

export type RenterRecord = TenantScopedRecord & { displayName: string; identityNumber?: string | null };

export class RentersService {
  constructor(private readonly renters: TenantAwareRepository<RenterRecord>) {}

  findRenterForTenant(id: string) {
    return this.renters.findById(id);
  }
}
