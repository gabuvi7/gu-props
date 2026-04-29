import { Body, Controller, Delete, HttpCode, Param, Post } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { LIQUIDATIONS_PERMISSIONS } from "../../common/auth/permissions";
import { addManualAdjustmentSchema } from "./liquidations.dto";
import { LiquidationsService } from "./liquidations.service";

/**
 * Endpoints HTTP para administrar ajustes manuales sobre una liquidación
 * en estado DRAFT (REQ-003). El service rechaza con 400 si la liquidación
 * ya salió de DRAFT y con 404 si no se encuentra el ajuste o la liquidación.
 *
 * Sub-recurso anidado bajo `liquidations` para mantener clara la jerarquía.
 */
@Controller("liquidations/:liquidationId/manual-adjustments")
export class ManualAdjustmentsController {
  constructor(private readonly service: LiquidationsService) {}

  @Post()
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.manualAdjustments)
  add(@Param("liquidationId") liquidationId: string, @Body() body: unknown) {
    return this.service.addManualAdjustment(
      liquidationId,
      parseRequestBody(addManualAdjustmentSchema, body)
    );
  }

  @Delete(":adjustmentId")
  @HttpCode(204)
  @RequiresRole(...LIQUIDATIONS_PERMISSIONS.manualAdjustments)
  async remove(
    @Param("liquidationId") liquidationId: string,
    @Param("adjustmentId") adjustmentId: string
  ): Promise<void> {
    // El service sigue devolviendo la liquidación recargada (uso interno),
    // pero el controller no propaga body para cumplir el contrato HTTP 204.
    await this.service.removeManualAdjustment(liquidationId, adjustmentId);
  }
}
