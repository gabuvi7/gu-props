import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { TemporaryHeaderRequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { AuditModule } from "./modules/audit/audit.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { OwnersModule } from "./modules/owners/owners.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { RentersModule } from "./modules/renters/renters.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TenantsModule } from "./modules/tenants/tenants.module";

export const appModules = [
  TenantsModule,
  OwnersModule,
  RentersModule,
  PropertiesModule,
  ContractsModule,
  PaymentsModule,
  ReportsModule,
  AuditModule
] as const;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true
    }),
    RequestContextModule,
    ...appModules
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // TEMPORAL: solo para desarrollo/testing hasta reemplazar headers por JWT auth.
    consumer
      .apply(TemporaryHeaderRequestContextMiddleware)
      .forRoutes("owners", "renters", "properties", "contracts", "payments", "cash-movements", "reports");
  }
}
