import { TenantAwareRepository, type TenantScopedRecord } from "../../common/persistence/tenant-aware.repository";

export type PropertyRecord = TenantScopedRecord & { ownerId: string; addressLine: string };

export class PropertiesService {
  constructor(private readonly properties: TenantAwareRepository<PropertyRecord>) {}

  findPropertyForTenant(id: string) {
    return this.properties.findById(id);
  }
}
