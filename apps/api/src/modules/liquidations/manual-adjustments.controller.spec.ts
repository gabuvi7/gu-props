import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Constante interna del decorador `@HttpCode` de Nest. Hardcodeada acá para no
// depender del subpath `@nestjs/common/constants` que no está en `exports`.
// Ref: node_modules/@nestjs/common/constants.js → `HTTP_CODE_METADATA = '__httpCode__'`.
const HTTP_CODE_METADATA = "__httpCode__";
import { REQUIRES_ROLE_KEY } from "../../common/auth/roles.decorator";
import { LIQUIDATIONS_PERMISSIONS } from "../../common/auth/permissions";
import { ManualAdjustmentsController } from "./manual-adjustments.controller";
import type { LiquidationsService } from "./liquidations.service";

type ServiceMock = {
  addManualAdjustment: ReturnType<typeof vi.fn>;
  removeManualAdjustment: ReturnType<typeof vi.fn>;
};

function createServiceMock(): ServiceMock {
  return {
    addManualAdjustment: vi.fn(),
    removeManualAdjustment: vi.fn()
  };
}

function buildController(service: ServiceMock): ManualAdjustmentsController {
  return new ManualAdjustmentsController(service as unknown as LiquidationsService);
}

function validAdjustmentBody() {
  return {
    concept: "Reembolso de gas",
    amount: "1500.00",
    sign: "CREDIT"
  };
}

describe("ManualAdjustmentsController", () => {
  let service: ServiceMock;
  let controller: ManualAdjustmentsController;

  beforeEach(() => {
    service = createServiceMock();
    controller = buildController(service);
  });

  describe("POST /liquidations/:liquidationId/manual-adjustments", () => {
    it("delegates to service.addManualAdjustment with liquidationId and parsed body", async () => {
      const expected = { id: "liq-1" };
      service.addManualAdjustment.mockResolvedValue(expected);

      const result = await controller.add("liq-1", validAdjustmentBody());

      expect(service.addManualAdjustment).toHaveBeenCalledTimes(1);
      expect(service.addManualAdjustment).toHaveBeenCalledWith(
        "liq-1",
        expect.objectContaining({
          concept: "Reembolso de gas",
          amount: "1500.00",
          sign: "CREDIT"
        })
      );
      expect(result).toBe(expected);
    });

    it("propagates validation error when body is invalid (missing concept)", () => {
      const invalid = { amount: "1500.00", sign: "CREDIT" };

      expect(() => controller.add("liq-1", invalid)).toThrow();
      expect(service.addManualAdjustment).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /liquidations/:liquidationId/manual-adjustments/:adjustmentId", () => {
    it("delegates to service.removeManualAdjustment with both ids and does NOT propagate body", async () => {
      // El spec del endpoint manda HTTP 204 sin body. El service puede seguir
      // devolviendo la liquidación recargada para uso interno; el controller
      // no la propaga.
      service.removeManualAdjustment.mockResolvedValue({ id: "liq-1" });

      const result = await controller.remove("liq-1", "adj-1");

      expect(service.removeManualAdjustment).toHaveBeenCalledTimes(1);
      expect(service.removeManualAdjustment).toHaveBeenCalledWith("liq-1", "adj-1");
      expect(result).toBeUndefined();
    });

    it("declara @HttpCode(204) en metadata para cumplir el contrato HTTP", () => {
      expect(
        Reflect.getMetadata(HTTP_CODE_METADATA, ManualAdjustmentsController.prototype.remove)
      ).toBe(204);
    });
  });

  describe("@RequiresRole metadata", () => {
    it("add → LIQUIDATIONS_PERMISSIONS.manualAdjustments", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, ManualAdjustmentsController.prototype.add)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.manualAdjustments]);
    });

    it("remove → LIQUIDATIONS_PERMISSIONS.manualAdjustments", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, ManualAdjustmentsController.prototype.remove)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.manualAdjustments]);
    });
  });
});
