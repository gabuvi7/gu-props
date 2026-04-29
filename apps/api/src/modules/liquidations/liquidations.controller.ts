import { Body, Controller, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { LIQUIDATIONS_PERMISSIONS } from "../../common/auth/permissions";
import {
  changeLiquidationStatusSchema,
  createLiquidationSchema,
  listLiquidationsQuerySchema,
  previewLiquidationSchema,
  updateLiquidationDraftSchema
} from "./liquidations.dto";
import { LiquidationsService } from "./liquidations.service";

/**
 * Endpoints HTTP del módulo de liquidaciones (US-025/US-026).
 *
 * Cada handler valida el body/query con `parseRequestBody` (devuelve 400 con
 * mensaje en español rioplatense si falla) y delega al service. La metadata
 * `@RequiresRole(...)` viene de la matriz `LIQUIDATIONS_PERMISSIONS` (REQ-013);
 * el `RolesGuard` global está en placeholder mode hasta US-007.
 */
@Controller("liquidations")
export class LiquidationsController {
  constructor(private readonly service: LiquidationsService) {}

  @Post("preview")
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.preview)
  preview(@Body() body: unknown) {
    return this.service.previewLiquidation(parseRequestBody(previewLiquidationSchema, body));
  }

  @Post()
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.service.createLiquidation(parseRequestBody(createLiquidationSchema, body));
  }

  @Get()
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.list)
  list(@Query() query: unknown) {
    return this.service.listLiquidations(parseRequestBody(listLiquidationsQuerySchema, query));
  }

  @Get(":id")
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.read)
  getById(@Param("id") id: string) {
    return this.service.getLiquidationById(id);
  }

  @Patch(":id")
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.updateDraft)
  updateDraft(@Param("id") id: string, @Body() body: unknown) {
    return this.service.updateDraft(id, parseRequestBody(updateLiquidationDraftSchema, body));
  }

  @Patch(":id/status")
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.changeStatus)
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.service.changeStatus(id, parseRequestBody(changeLiquidationStatusSchema, body));
  }

  /**
   * `GET /liquidations/:id/pdf` — devuelve el PDF como stream con
   * `Content-Type: application/pdf` y `Content-Disposition: inline; filename="..."`.
   * El service hace self-healing si el archivo se perdió pero el Document existe
   * (REQ-010). DRAFT y VOIDED rechazan con 400.
   *
   * El filename viene del Document persistido (`liquidacion-{id}.pdf`).
   */
  @Get(":id/pdf")
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.download)
  async getPdf(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const { stream, filename, mimeType } = await this.service.getOrGeneratePdf(id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    stream.pipe(res);
  }
}
