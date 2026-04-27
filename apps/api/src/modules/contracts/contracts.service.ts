import { TenantAwareRepository, type TenantScopedRecord } from "../../common/persistence/tenant-aware.repository";

export type ContractRecord = TenantScopedRecord & { propertyId: string; ownerId: string; renterId: string };

export class ContractsService {
  constructor(private readonly contracts: TenantAwareRepository<ContractRecord>) {}

  findContractForTenant(id: string) {
    return this.contracts.findById(id);
  }
}
