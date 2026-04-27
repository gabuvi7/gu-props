import { AuditModule } from "./modules/audit/audit.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { OwnersModule } from "./modules/owners/owners.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { RentersModule } from "./modules/renters/renters.module";
import { TenantsModule } from "./modules/tenants/tenants.module";

export const appModules = [
  TenantsModule,
  OwnersModule,
  RentersModule,
  PropertiesModule,
  ContractsModule,
  PaymentsModule,
  AuditModule
] as const;
