import { APP_GUARD } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { RolesGuard } from "../../common/auth/roles.guard";
import { DOCUMENT_STORAGE } from "../../common/storage/document-storage.interface";
import { createLocalDocumentStorage } from "../../common/storage/local-document-storage";
import { resolveStorageBasePath } from "../../common/storage/storage.config";
import { LiquidationCalculator } from "./calculation/liquidation-calculator";
import { LiquidationStateMachine } from "./state-machine/liquidation-state-machine";
import { PDF_RENDERER } from "./pdf/pdf-renderer";
import { PdfKitLiquidationRenderer } from "./pdf/pdf-renderer";
import { LiquidationsController } from "./liquidations.controller";
import { LiquidationsService } from "./liquidations.service";
import { ManualAdjustmentsController } from "./manual-adjustments.controller";

/**
 * Módulo de Liquidaciones (US-025/US-026).
 *
 * Providers no triviales:
 *  - `LiquidationCalculator` y `LiquidationStateMachine` son clases puras sin
 *    `@Injectable`; las registramos por `useFactory` para mantenerlas DI-aware
 *    sin acoplarlas al runtime de Nest.
 *  - `PDF_RENDERER` (symbol) → `PdfKitLiquidationRenderer`. Usamos token porque
 *    `PdfRenderer` es una interface y no existe en runtime; el service consume
 *    con `@Inject(PDF_RENDERER)`.
 *  - `DOCUMENT_STORAGE` (symbol) → `LocalDocumentStorage` con base path resuelto
 *    en cada bootstrap. En producción se reemplaza por una factory R2/S3 sin
 *    tocar consumidores.
 *  - `RolesGuard` registrado como `APP_GUARD` global. Está en placeholder mode
 *    (REQ-013): sólo loguea, no rechaza. Cuando US-007 active enforcement, el
 *    guard pasa a rechazar con 403 sin tocar nada acá.
 */
@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [LiquidationsController, ManualAdjustmentsController],
  providers: [
    LiquidationsService,
    { provide: LiquidationCalculator, useFactory: () => new LiquidationCalculator() },
    { provide: LiquidationStateMachine, useFactory: () => new LiquidationStateMachine() },
    { provide: PDF_RENDERER, useFactory: () => new PdfKitLiquidationRenderer() },
    {
      provide: DOCUMENT_STORAGE,
      useFactory: () => createLocalDocumentStorage(resolveStorageBasePath())
    },
    { provide: APP_GUARD, useClass: RolesGuard }
  ],
  exports: [LiquidationsService]
})
export class LiquidationsModule {}
