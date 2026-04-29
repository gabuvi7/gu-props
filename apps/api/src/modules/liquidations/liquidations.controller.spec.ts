import "reflect-metadata";
import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REQUIRES_ROLE_KEY } from "../../common/auth/roles.decorator";
import { LIQUIDATIONS_PERMISSIONS } from "../../common/auth/permissions";
import { LiquidationsController } from "./liquidations.controller";
import type { LiquidationsService } from "./liquidations.service";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

type ServiceMock = {
  previewLiquidation: ReturnType<typeof vi.fn>;
  createLiquidation: ReturnType<typeof vi.fn>;
  listLiquidations: ReturnType<typeof vi.fn>;
  getLiquidationById: ReturnType<typeof vi.fn>;
  updateDraft: ReturnType<typeof vi.fn>;
  changeStatus: ReturnType<typeof vi.fn>;
  getOrGeneratePdf: ReturnType<typeof vi.fn>;
};

function createServiceMock(): ServiceMock {
  return {
    previewLiquidation: vi.fn(),
    createLiquidation: vi.fn(),
    listLiquidations: vi.fn(),
    getLiquidationById: vi.fn(),
    updateDraft: vi.fn(),
    changeStatus: vi.fn(),
    getOrGeneratePdf: vi.fn()
  };
}

function buildController(service: ServiceMock): LiquidationsController {
  return new LiquidationsController(service as unknown as LiquidationsService);
}

function validPreviewBody() {
  return {
    ownerId: "owner-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    currency: "ARS"
  };
}

function validCreateBody() {
  return {
    ownerId: "owner-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    currency: "ARS"
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("LiquidationsController", () => {
  let service: ServiceMock;
  let controller: LiquidationsController;

  beforeEach(() => {
    service = createServiceMock();
    controller = buildController(service);
  });

  describe("POST /liquidations/preview", () => {
    it("delegates to service.previewLiquidation with the parsed body", async () => {
      const expected = { totals: { netAmount: "1000.00" } };
      service.previewLiquidation.mockResolvedValue(expected);

      const result = await controller.preview(validPreviewBody());

      expect(service.previewLiquidation).toHaveBeenCalledTimes(1);
      expect(service.previewLiquidation).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "owner-1",
          currency: "ARS"
        })
      );
      expect(result).toBe(expected);
    });

    it("propagates Zod validation error when body is invalid", () => {
      const invalid = { periodStart: "2026-01-01", periodEnd: "2026-01-31", currency: "ARS" };

      // `parseRequestBody` lanza sincronicamente antes de tocar al service.
      expect(() => controller.preview(invalid)).toThrow();
      expect(service.previewLiquidation).not.toHaveBeenCalled();
    });
  });

  describe("POST /liquidations", () => {
    it("delegates to service.createLiquidation with the parsed body", async () => {
      const expected = { id: "liq-1" };
      service.createLiquidation.mockResolvedValue(expected);

      const result = await controller.create(validCreateBody());

      expect(service.createLiquidation).toHaveBeenCalledTimes(1);
      expect(service.createLiquidation).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: "owner-1", currency: "ARS" })
      );
      expect(result).toBe(expected);
    });

    it("accepts optional empty manualAdjustments", async () => {
      service.createLiquidation.mockResolvedValue({ id: "liq-2" });

      await controller.create({ ...validCreateBody(), manualAdjustments: [] });

      expect(service.createLiquidation).toHaveBeenCalledTimes(1);
      const arg = service.createLiquidation.mock.calls[0][0];
      expect(Array.isArray(arg.manualAdjustments)).toBe(true);
      expect(arg.manualAdjustments).toHaveLength(0);
    });
  });

  describe("GET /liquidations", () => {
    it("delegates to service.listLiquidations with empty query (defaults applied)", async () => {
      service.listLiquidations.mockResolvedValue([]);

      const result = await controller.list({});

      expect(service.listLiquidations).toHaveBeenCalledTimes(1);
      // El schema permite todos los campos opcionales; con `{}` el shape parsed es `{}`.
      expect(service.listLiquidations).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toEqual([]);
    });

    it("forwards query filters to the service", async () => {
      service.listLiquidations.mockResolvedValue([]);

      await controller.list({ ownerId: "owner-1", status: "DRAFT", currency: "ARS" });

      expect(service.listLiquidations).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: "owner-1", status: "DRAFT", currency: "ARS" })
      );
    });
  });

  describe("GET /liquidations/:id", () => {
    it("delegates to service.getLiquidationById with the id", async () => {
      const expected = { id: "liq-1" };
      service.getLiquidationById.mockResolvedValue(expected);

      const result = await controller.getById("liq-1");

      expect(service.getLiquidationById).toHaveBeenCalledWith("liq-1");
      expect(result).toBe(expected);
    });
  });

  describe("PATCH /liquidations/:id", () => {
    it("delegates to service.updateDraft with id and parsed body", async () => {
      const expected = { id: "liq-1", notes: "hola" };
      service.updateDraft.mockResolvedValue(expected);

      const result = await controller.updateDraft("liq-1", { notes: "hola" });

      expect(service.updateDraft).toHaveBeenCalledTimes(1);
      expect(service.updateDraft).toHaveBeenCalledWith(
        "liq-1",
        expect.objectContaining({ notes: "hola" })
      );
      expect(result).toBe(expected);
    });

    it("accepts an empty body (no changes)", async () => {
      service.updateDraft.mockResolvedValue({ id: "liq-1" });

      await controller.updateDraft("liq-1", {});

      expect(service.updateDraft).toHaveBeenCalledWith("liq-1", expect.any(Object));
    });
  });

  describe("PATCH /liquidations/:id/status", () => {
    it("delegates to service.changeStatus with id and parsed body", async () => {
      const expected = { id: "liq-1", status: "ISSUED" };
      service.changeStatus.mockResolvedValue(expected);

      const result = await controller.changeStatus("liq-1", { status: "ISSUED" });

      expect(service.changeStatus).toHaveBeenCalledTimes(1);
      expect(service.changeStatus).toHaveBeenCalledWith(
        "liq-1",
        expect.objectContaining({ status: "ISSUED" })
      );
      expect(result).toBe(expected);
    });

    it("forwards optional voidReason for VOIDED transitions", async () => {
      service.changeStatus.mockResolvedValue({ id: "liq-1", status: "VOIDED" });

      await controller.changeStatus("liq-1", { status: "VOIDED", voidReason: "duplicada" });

      expect(service.changeStatus).toHaveBeenCalledWith(
        "liq-1",
        expect.objectContaining({ status: "VOIDED", voidReason: "duplicada" })
      );
    });
  });

  describe("GET /liquidations/:id/pdf", () => {
    function createResponseMock(): Response {
      return {
        setHeader: vi.fn()
      } as unknown as Response;
    }

    type PdfStreamMock = { pipe: ReturnType<typeof vi.fn> };

    function createPdfStreamMock(): PdfStreamMock {
      // Shim mínimo: el controller sólo invoca `stream.pipe(res)`. No usamos
      // `Readable.from` para evitar tener que reasignar `pipe` (TS strict se
      // queja por la firma original) y para mantener la aserción precisa.
      return { pipe: vi.fn().mockReturnValue(undefined) };
    }

    it("delegates to service.getOrGeneratePdf and pipes the stream into the response", async () => {
      const stream = createPdfStreamMock();
      const res = createResponseMock();
      service.getOrGeneratePdf.mockResolvedValue({
        stream,
        filename: "liquidacion-liq-1.pdf",
        mimeType: "application/pdf"
      });

      await controller.getPdf("liq-1", res);

      expect(service.getOrGeneratePdf).toHaveBeenCalledWith("liq-1");
      expect(stream.pipe).toHaveBeenCalledTimes(1);
      expect(stream.pipe).toHaveBeenCalledWith(res);
    });

    it("sets Content-Type with the resolved mime type", async () => {
      const stream = createPdfStreamMock();
      const res = createResponseMock();
      service.getOrGeneratePdf.mockResolvedValue({
        stream,
        filename: "liquidacion-liq-1.pdf",
        mimeType: "application/pdf"
      });

      await controller.getPdf("liq-1", res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    });

    it("sets Content-Disposition inline with the resolved filename", async () => {
      const stream = createPdfStreamMock();
      const res = createResponseMock();
      service.getOrGeneratePdf.mockResolvedValue({
        stream,
        filename: "liquidacion-liq-1.pdf",
        mimeType: "application/pdf"
      });

      await controller.getPdf("liq-1", res);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'inline; filename="liquidacion-liq-1.pdf"'
      );
    });
  });

  describe("@RequiresRole metadata", () => {
    it("preview → LIQUIDATIONS_PERMISSIONS.preview", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.preview)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.preview]);
    });

    it("create → LIQUIDATIONS_PERMISSIONS.create", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.create)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.create]);
    });

    it("list → LIQUIDATIONS_PERMISSIONS.list", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.list)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.list]);
    });

    it("getById → LIQUIDATIONS_PERMISSIONS.read", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.getById)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.read]);
    });

    it("updateDraft → LIQUIDATIONS_PERMISSIONS.updateDraft", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.updateDraft)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.updateDraft]);
    });

    it("changeStatus → LIQUIDATIONS_PERMISSIONS.changeStatus", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.changeStatus)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.changeStatus]);
    });

    it("getPdf → LIQUIDATIONS_PERMISSIONS.download", () => {
      expect(
        Reflect.getMetadata(REQUIRES_ROLE_KEY, LiquidationsController.prototype.getPdf)
      ).toEqual([...LIQUIDATIONS_PERMISSIONS.download]);
    });
  });
});
