import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { DocumentStorage } from "../../common/storage/document-storage.interface";
import { LiquidationCalculator } from "./calculation/liquidation-calculator";
import { LiquidationStateMachine } from "./state-machine/liquidation-state-machine";
import { PdfKitLiquidationRenderer } from "./pdf/pdf-renderer";
import { LiquidationsService } from "./liquidations.service";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    owner: { findFirst: vi.fn(), findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
    payment: { findMany: vi.fn() },
    property: { findMany: vi.fn() },
    tenantSettings: { findUnique: vi.fn(), findFirst: vi.fn() },
    liquidation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    liquidationLineItem: { create: vi.fn(), createMany: vi.fn() },
    liquidationManualAdjustment: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn()
    },
    document: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    cashMovement: { create: vi.fn() },
    $transaction: vi.fn()
  } as unknown as PrismaService;
}

function createStorageMock(): DocumentStorage & {
  save: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
} {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    read: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined)
  } as never;
}

function createRendererMock(): PdfKitLiquidationRenderer & { render: ReturnType<typeof vi.fn> } {
  // No instanciamos el renderer real porque requiere pdfkit. Le asignamos un
  // shim con `render` mockeado que devuelve un Readable trivial.
  const renderer = Object.create(PdfKitLiquidationRenderer.prototype) as PdfKitLiquidationRenderer & {
    render: ReturnType<typeof vi.fn>;
  };
  renderer.render = vi.fn(() => Readable.from(Buffer.from("PDF-CONTENT")));
  return renderer;
}

type Ctx = { tenantId: string; userId: string | null; role: string; requestId: string };

function createContextMock(overrides: Partial<Ctx> = {}): RequestContextService {
  const ctx: Ctx = {
    tenantId: "tenant-a",
    userId: "user-1",
    role: "ADMIN",
    requestId: "req-1",
    ...overrides
  };
  return { get: () => ctx } as unknown as RequestContextService;
}

function buildService(
  prisma: PrismaService,
  context: RequestContextService,
  options: {
    renderer?: PdfKitLiquidationRenderer;
    storage?: DocumentStorage;
  } = {}
): LiquidationsService {
  const renderer = options.renderer ?? createRendererMock();
  const storage = options.storage ?? createStorageMock();
  return new LiquidationsService(
    prisma,
    context,
    new LiquidationCalculator(),
    new LiquidationStateMachine(),
    renderer,
    storage
  );
}

function mockTransactionPassthrough(prisma: PrismaService): {
  tx: {
    liquidation: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
    liquidationLineItem: { createMany: ReturnType<typeof vi.fn> };
    liquidationManualAdjustment: { createMany: ReturnType<typeof vi.fn> };
  };
} {
  const tx = {
    liquidation: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    liquidationLineItem: { createMany: vi.fn() },
    liquidationManualAdjustment: { createMany: vi.fn() }
  };
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
  return { tx };
}

const previewInput = {
  ownerId: "owner-1",
  periodStart: "2026-04-01T00:00:00.000Z",
  periodEnd: "2026-04-30T23:59:59.999Z",
  currency: "ARS" as const
};

const createInput = {
  ...previewInput,
  notes: undefined,
  manualAdjustments: [] as Array<{ concept: string; amount: string; sign: "CREDIT" | "DEBIT" }>
};

function mockOwnerFound(prisma: PrismaService, tenantId = "tenant-a", ownerId = "owner-1") {
  vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: ownerId, tenantId } as never);
}

function mockOwnerMissing(prisma: PrismaService) {
  vi.mocked(prisma.owner.findFirst).mockResolvedValue(null as never);
}

function mockTenantSettings(prisma: PrismaService, defaultCommissionBps = 0) {
  vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
    id: "ts-1",
    tenantId: "tenant-a",
    defaultCommissionBps,
    legalIdentity: null,
    commercialName: "Inmobiliaria Demo"
  } as never);
}

function mockProperties(
  prisma: PrismaService,
  properties: Array<{ id: string; commissionBps: number | null; addressLine?: string }> = []
) {
  vi.mocked(prisma.property.findMany).mockResolvedValue(
    properties.map((p) => ({ ...p, addressLine: p.addressLine ?? `Address ${p.id}` })) as never
  );
}

function buildPrismaPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    tenantId: "tenant-a",
    contractId: "contract-1",
    paidAt: new Date("2026-04-15T12:00:00.000Z"),
    paidAmount: "100000.00",
    dueAmount: "100000.00",
    currency: "ARS",
    status: "PAID",
    contract: { id: "contract-1", propertyId: "prop-1", ownerId: "owner-1" },
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// previewLiquidation
// ─────────────────────────────────────────────────────────────────────────────

describe("LiquidationsService — previewLiquidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404 si el owner no pertenece al tenant", async () => {
    const prisma = createPrismaMock();
    mockOwnerMissing(prisma);
    const service = buildService(prisma, createContextMock());

    await expect(service.previewLiquidation(previewInput)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.previewLiquidation(previewInput)).rejects.toThrow(
      "No encontramos el propietario solicitado."
    );

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({
      where: { id: "owner-1", tenantId: "tenant-a", deletedAt: null }
    });
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("filtra pagos del período por tenantId, currency, status excluyendo VOIDED/PENDING y por ownerId del contrato", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, [{ id: "prop-1", commissionBps: 1000 }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([buildPrismaPayment()] as never);
    const service = buildService(prisma, createContextMock("tenant-a" as never));

    await service.previewLiquidation(previewInput);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          currency: "ARS",
          status: { notIn: ["VOIDED", "PENDING"] },
          paidAt: { gte: new Date(previewInput.periodStart), lte: new Date(previewInput.periodEnd) },
          contract: { ownerId: "owner-1" }
        })
      })
    );
  });

  it("delega el cálculo al calculator y devuelve totals + lineItems sin persistir", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, [{ id: "prop-1", commissionBps: 1000 }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      buildPrismaPayment({ paidAmount: "100000.00", dueAmount: "100000.00" })
    ] as never);
    const service = buildService(prisma, createContextMock());

    const result = await service.previewLiquidation(previewInput);

    expect(result.totals.grossAmount).toBe("100000.00");
    expect(result.totals.commissionAmount).toBe("10000.00");
    expect(result.totals.netAmount).toBe("90000.00");
    expect(result.totals.adjustmentsTotal).toBe("0.00");
    expect(result.totals.currency).toBe("ARS");
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].paymentId).toBe("pay-1");
    expect(result.lineItems[0].propertyAddress).toBe("Address prop-1");

    expect(prisma.liquidation.create).not.toHaveBeenCalled();
  });

  it("sin pagos en el período: totales en 0.00 y lineItems vacíos", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, []);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    const result = await service.previewLiquidation(previewInput);

    expect(result.lineItems).toEqual([]);
    expect(result.totals).toEqual({
      grossAmount: "0.00",
      commissionAmount: "0.00",
      adjustmentsTotal: "0.00",
      netAmount: "0.00",
      currency: "ARS"
    });
  });

  it("usa defaultCommissionBps del tenant si la propiedad no tiene commissionBps", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 500); // 5%
    mockProperties(prisma, [{ id: "prop-1", commissionBps: null }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      buildPrismaPayment({ paidAmount: "100000.00", dueAmount: "100000.00" })
    ] as never);
    const service = buildService(prisma, createContextMock());

    const result = await service.previewLiquidation(previewInput);

    expect(result.lineItems[0].commissionBpsApplied).toBe(500);
    expect(result.lineItems[0].commissionAmount).toBe("5000.00");
  });

  it("scopea owner.findFirst por tenant del contexto", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma, "tenant-b");
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, []);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-b" }));

    await service.previewLiquidation(previewInput);

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({
      where: { id: "owner-1", tenantId: "tenant-b", deletedAt: null }
    });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-b" })
      })
    );
    expect(prisma.tenantSettings.findUnique).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b" }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createLiquidation
// ─────────────────────────────────────────────────────────────────────────────

describe("LiquidationsService — createLiquidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza con NotFound si el owner no pertenece al tenant", async () => {
    const prisma = createPrismaMock();
    mockOwnerMissing(prisma);
    const service = buildService(prisma, createContextMock());

    await expect(service.createLiquidation(createInput)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createLiquidation(createInput)).rejects.toThrow(
      "No encontramos el propietario solicitado."
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("409 si ya existe una liquidación activa (DRAFT/ISSUED/PAID) para misma clave", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, [{ id: "prop-1", commissionBps: 1000 }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([buildPrismaPayment()] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue({ id: "existing", status: "DRAFT" } as never);
    const service = buildService(prisma, createContextMock());

    await expect(service.createLiquidation(createInput)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createLiquidation(createInput)).rejects.toThrow(
      "Ya existe una liquidación activa para este propietario, período y moneda."
    );

    expect(prisma.liquidation.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        ownerId: "owner-1",
        periodStart: new Date(createInput.periodStart),
        periodEnd: new Date(createInput.periodEnd),
        currency: "ARS",
        status: { in: ["DRAFT", "ISSUED", "PAID"] }
      }
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("permite crear si la liquidación previa para misma clave está VOIDED", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, [{ id: "prop-1", commissionBps: 0 }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue(null as never); // no activa, la VOIDED no entra al filtro
    const { tx } = mockTransactionPassthrough(prisma);
    tx.liquidation.create.mockResolvedValue({
      id: "liq-new",
      tenantId: "tenant-a",
      ownerId: "owner-1",
      status: "DRAFT",
      lineItems: [],
      manualAdjustments: []
    });
    const service = buildService(prisma, createContextMock());

    const result = await service.createLiquidation(createInput);

    expect(result.id).toBe("liq-new");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("crea Liquidation DRAFT + line items + adjustments en una transacción", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, [{ id: "prop-1", commissionBps: 1000 }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      buildPrismaPayment({ paidAmount: "100000.00", dueAmount: "100000.00" })
    ] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue(null as never);
    const { tx } = mockTransactionPassthrough(prisma);
    tx.liquidation.create.mockResolvedValue({
      id: "liq-1",
      tenantId: "tenant-a",
      ownerId: "owner-1",
      status: "DRAFT",
      lineItems: [],
      manualAdjustments: []
    });

    const service = buildService(prisma, createContextMock());
    const adjustments = [{ concept: "Bonificación", amount: "5000.00", sign: "CREDIT" as const }];

    await service.createLiquidation({ ...createInput, manualAdjustments: adjustments, notes: "Liquidación abril" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.liquidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-a",
          ownerId: "owner-1",
          status: "DRAFT",
          currency: "ARS",
          grossAmount: "100000.00",
          commissionAmount: "10000.00",
          netAmount: "95000.00", // 100000 - 10000 + 5000
          notes: "Liquidación abril",
          createdById: "user-1"
        })
      })
    );
    expect(tx.liquidationLineItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          liquidationId: "liq-1",
          paymentId: "pay-1",
          contractId: "contract-1",
          propertyId: "prop-1",
          propertyAddress: "Address prop-1",
          paidAmount: "100000.00",
          dueAmount: "100000.00",
          liquidableAmount: "100000.00",
          commissionBpsApplied: 1000,
          commissionAmount: "10000.00",
          netAmount: "90000.00",
          currency: "ARS"
        })
      ]
    });
    expect(tx.liquidationManualAdjustment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          liquidationId: "liq-1",
          concept: "Bonificación",
          amount: "5000.00",
          sign: "CREDIT",
          createdById: "user-1"
        })
      ]
    });
  });

  it("createdById queda null si no hay userId en el contexto", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, []);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue(null as never);
    const { tx } = mockTransactionPassthrough(prisma);
    tx.liquidation.create.mockResolvedValue({ id: "liq-x", lineItems: [], manualAdjustments: [] });
    const service = buildService(prisma, createContextMock({ userId: null }));

    await service.createLiquidation(createInput);

    expect(tx.liquidation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: null }) })
    );
  });

  it("no crea adjustments cuando manualAdjustments es vacío", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, [{ id: "prop-1", commissionBps: 0 }]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      buildPrismaPayment({ paidAmount: "100000.00", dueAmount: "100000.00" })
    ] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue(null as never);
    const { tx } = mockTransactionPassthrough(prisma);
    tx.liquidation.create.mockResolvedValue({ id: "liq-2", lineItems: [], manualAdjustments: [] });
    const service = buildService(prisma, createContextMock());

    await service.createLiquidation({ ...createInput, manualAdjustments: [] });

    expect(tx.liquidationManualAdjustment.createMany).not.toHaveBeenCalled();
    // El neto NO incluye adjustments (gross - commission).
    expect(tx.liquidation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ netAmount: "100000.00" }) })
    );
  });

  it("mapea unique constraint de carrera (P2002) a ConflictException con el mismo mensaje", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma);
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, []);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue({
      code: "P2002",
      message: "Unique constraint failed"
    });
    const service = buildService(prisma, createContextMock());

    await expect(service.createLiquidation(createInput)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createLiquidation(createInput)).rejects.toThrow(
      "Ya existe una liquidación activa para este propietario, período y moneda."
    );
  });

  it("scopea todas las queries por tenant del contexto", async () => {
    const prisma = createPrismaMock();
    mockOwnerFound(prisma, "tenant-z");
    mockTenantSettings(prisma, 0);
    mockProperties(prisma, []);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.liquidation.findFirst).mockResolvedValue(null as never);
    const { tx } = mockTransactionPassthrough(prisma);
    tx.liquidation.create.mockResolvedValue({ id: "liq-z", lineItems: [], manualAdjustments: [] });
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-z" }));

    await service.createLiquidation(createInput);

    expect(prisma.owner.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-z" }) }));
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-z" }) }));
    expect(prisma.liquidation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-z" }) }));
    expect(tx.liquidation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-z" }) }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getLiquidationById
// ─────────────────────────────────────────────────────────────────────────────

describe("LiquidationsService — getLiquidationById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca por id_tenantId con includes de lineItems y manualAdjustments", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue({
      id: "liq-1",
      tenantId: "tenant-a",
      lineItems: [],
      manualAdjustments: []
    } as never);
    const service = buildService(prisma, createContextMock());

    const result = await service.getLiquidationById("liq-1");

    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      include: { lineItems: true, manualAdjustments: true }
    });
    expect(result.id).toBe("liq-1");
  });

  it("404 si no existe en el tenant activo", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock());

    await expect(service.getLiquidationById("liq-x")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getLiquidationById("liq-x")).rejects.toThrow("No encontramos la liquidación solicitada.");
  });

  it("aísla por tenant: una liquidación de otro tenant no aparece", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-other" }));

    await expect(service.getLiquidationById("liq-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-other" } },
      include: { lineItems: true, manualAdjustments: true }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listLiquidations
// ─────────────────────────────────────────────────────────────────────────────

describe("LiquidationsService — listLiquidations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista todas las liquidations del tenant cuando query es vacío", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    await service.listLiquidations({});

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a" },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("filtra por ownerId cuando se pasa", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    await service.listLiquidations({ ownerId: "owner-9" });

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", ownerId: "owner-9" },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("filtra por status cuando se pasa", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    await service.listLiquidations({ status: "ISSUED" });

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", status: "ISSUED" },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("filtra por currency cuando se pasa", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    await service.listLiquidations({ currency: "USD" });

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", currency: "USD" },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("filtra por rango de fechas usando solapamiento inclusive", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    const queryStart = "2026-04-01T00:00:00.000Z";
    const queryEnd = "2026-04-30T23:59:59.999Z";
    await service.listLiquidations({ periodStart: queryStart, periodEnd: queryEnd });

    // overlap: Liquidation.periodEnd >= queryStart AND Liquidation.periodStart <= queryEnd.
    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        periodEnd: { gte: new Date(queryStart) },
        periodStart: { lte: new Date(queryEnd) }
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("solo periodStart: filtra Liquidation.periodEnd >= queryStart", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    const queryStart = "2026-04-01T00:00:00.000Z";
    await service.listLiquidations({ periodStart: queryStart });

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", periodEnd: { gte: new Date(queryStart) } },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("solo periodEnd: filtra Liquidation.periodStart <= queryEnd", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    const queryEnd = "2026-04-30T23:59:59.999Z";
    await service.listLiquidations({ periodEnd: queryEnd });

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", periodStart: { lte: new Date(queryEnd) } },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("combina filtros: ownerId + status + currency + período", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    await service.listLiquidations({
      ownerId: "owner-1",
      status: "PAID",
      currency: "ARS",
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-12-31T23:59:59.999Z"
    });

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        ownerId: "owner-1",
        status: "PAID",
        currency: "ARS",
        periodEnd: { gte: new Date("2026-01-01T00:00:00.000Z") },
        periodStart: { lte: new Date("2026-12-31T23:59:59.999Z") }
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  });

  it("orden descendente por periodEnd y luego createdAt", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock());

    await service.listLiquidations({});

    const call = vi.mocked(prisma.liquidation.findMany).mock.calls[0][0];
    expect(call?.orderBy).toEqual([{ periodEnd: "desc" }, { createdAt: "desc" }]);
  });

  it("scopea por tenant: liquidations de otro tenant no aparecen", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findMany).mockResolvedValue([] as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-foreign" }));

    await service.listLiquidations({});

    expect(prisma.liquidation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-foreign" }) })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateDraft (TASK-025)
// ─────────────────────────────────────────────────────────────────────────────

function makeLiquidation(overrides: Record<string, unknown> = {}) {
  return {
    id: "liq-1",
    tenantId: "tenant-a",
    ownerId: "owner-1",
    status: "DRAFT" as const,
    currency: "ARS" as const,
    periodStart: new Date("2026-04-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T23:59:59.999Z"),
    grossAmount: "100000.00",
    commissionAmount: "10000.00",
    netAmount: "90000.00",
    notes: null,
    issuedAt: null,
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    createdById: "user-1",
    lineItems: [],
    manualAdjustments: [],
    ...overrides
  };
}

describe("LiquidationsService — updateDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("actualiza notes en estado DRAFT y devuelve la liquidación con relaciones", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ notes: null });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    vi.mocked(prisma.liquidation.update).mockResolvedValue({
      ...liquidation,
      notes: "Nuevas observaciones"
    } as never);
    const service = buildService(prisma, createContextMock());

    const result = await service.updateDraft("liq-1", { notes: "Nuevas observaciones" });

    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      include: { lineItems: true, manualAdjustments: true }
    });
    expect(prisma.liquidation.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      data: { notes: "Nuevas observaciones" },
      include: { lineItems: true, manualAdjustments: true }
    });
    expect(result.notes).toBe("Nuevas observaciones");
  });

  it("input vacío (sin notes) no llama a update y devuelve la liquidación tal cual", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ notes: "Existente" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    const service = buildService(prisma, createContextMock());

    const result = await service.updateDraft("liq-1", {});

    expect(prisma.liquidation.update).not.toHaveBeenCalled();
    expect(result.notes).toBe("Existente");
  });

  it("rechaza si la liquidación está ISSUED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.updateDraft("liq-1", { notes: "x" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateDraft("liq-1", { notes: "x" })).rejects.toThrow(
      "No se puede modificar una liquidación que ya fue emitida."
    );
    expect(prisma.liquidation.update).not.toHaveBeenCalled();
  });

  it("rechaza si la liquidación está PAID", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "PAID" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.updateDraft("liq-1", { notes: "x" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateDraft("liq-1", { notes: "x" })).rejects.toThrow(
      "No se puede modificar una liquidación que ya fue emitida."
    );
  });

  it("rechaza si la liquidación está VOIDED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "VOIDED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.updateDraft("liq-1", { notes: "x" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404 si la liquidación no existe", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock());

    await expect(service.updateDraft("liq-x", { notes: "x" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateDraft("liq-x", { notes: "x" })).rejects.toThrow(
      "No encontramos la liquidación solicitada."
    );
  });

  it("scopea por tenant del contexto en el lookup", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-other" }));

    await expect(service.updateDraft("liq-1", { notes: "x" })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-other" } },
      include: { lineItems: true, manualAdjustments: true }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changeStatus (TASK-027)
//
// transitionToIssued necesita: tenantSettings.findUnique, tenant.findUnique,
// owner.findUnique, renderer.render, storage.save, tx.document.create,
// tx.liquidation.update.
// transitionToPaid necesita: tx.liquidation.update + tx.cashMovement.create.
// transitionToVoided necesita: prisma.liquidation.update simple.
// ─────────────────────────────────────────────────────────────────────────────

function mockTenantContext(prisma: PrismaService) {
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
    id: "tenant-a",
    name: "Inmobiliaria Demo"
  } as never);
  vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
    id: "ts-1",
    tenantId: "tenant-a",
    commercialName: "Inmobiliaria Demo SRL",
    legalIdentity: { taxId: "30-12345678-9", licenseNumber: "Mat-001" },
    defaultCommissionBps: 1000
  } as never);
  vi.mocked(prisma.owner.findUnique).mockResolvedValue({
    id: "owner-1",
    tenantId: "tenant-a",
    displayName: "Propietario Uno",
    email: "owner@example.com",
    phone: "+5491100000000",
    taxId: "20-11111111-1"
  } as never);
}

function mockChangeStatusTransaction(prisma: PrismaService) {
  const tx = {
    liquidation: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn()
    },
    document: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    cashMovement: { create: vi.fn() }
  };
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
  return tx;
}

describe("LiquidationsService — changeStatus (DRAFT → ISSUED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("genera PDF, lo guarda en storage, crea Document y actualiza status + issuedAt (count=1, ganador)", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ status: "DRAFT" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    mockTenantContext(prisma);
    const tx = mockChangeStatusTransaction(prisma);
    tx.liquidation.updateMany.mockResolvedValue({ count: 1 });
    tx.liquidation.findUnique.mockResolvedValue({
      ...liquidation,
      status: "ISSUED",
      issuedAt: new Date()
    });
    tx.document.create.mockResolvedValue({ id: "doc-1" });

    const renderer = createRendererMock();
    const storage = createStorageMock();
    const service = buildService(prisma, createContextMock(), { renderer, storage });

    await service.changeStatus("liq-1", { status: "ISSUED" });

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledTimes(1);

    const expectedKey = "tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf";
    expect(storage.save).toHaveBeenCalledWith(expectedKey, expect.anything());

    // updateMany condicional por status DRAFT (REQ-010, race-safe).
    expect(tx.liquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "liq-1", tenantId: "tenant-a", status: "DRAFT" },
        data: expect.objectContaining({ status: "ISSUED", issuedAt: expect.any(Date) })
      })
    );

    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        type: "LIQUIDATION",
        entityType: "Liquidation",
        entityId: "liq-1",
        storageKey: expectedKey,
        mimeType: "application/pdf",
        fileName: "liquidacion-liq-1.pdf",
        createdById: "user-1"
      })
    });

    // El archivo NO se borra en happy path.
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("DRAFT → ISSUED con count=0 y status post-reload ISSUED + Document existente: idempotente, archivo NO se borra", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ status: "DRAFT" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    mockTenantContext(prisma);
    const tx = mockChangeStatusTransaction(prisma);
    tx.liquidation.updateMany.mockResolvedValue({ count: 0 });
    tx.liquidation.findUnique.mockResolvedValue({
      ...liquidation,
      status: "ISSUED",
      issuedAt: new Date(),
      lineItems: [],
      manualAdjustments: []
    });
    tx.document.findFirst.mockResolvedValue({
      id: "doc-winner",
      storageKey: "tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf"
    });

    const renderer = createRendererMock();
    const storage = createStorageMock();
    const service = buildService(prisma, createContextMock(), { renderer, storage });

    const result = await service.changeStatus("liq-1", { status: "ISSUED" });

    expect(result.status).toBe("ISSUED");
    expect(tx.document.create).not.toHaveBeenCalled();
    // Race detectada: el archivo NO se borra (lo conserva el ganador).
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("DRAFT → ISSUED con count=0 y status post-reload distinto: BadRequest y archivo SÍ se borra (cleanup)", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ status: "DRAFT" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    mockTenantContext(prisma);
    const tx = mockChangeStatusTransaction(prisma);
    tx.liquidation.updateMany.mockResolvedValue({ count: 0 });
    tx.liquidation.findUnique.mockResolvedValue({
      ...liquidation,
      status: "VOIDED",
      voidedAt: new Date(),
      lineItems: [],
      manualAdjustments: []
    });
    tx.document.findFirst.mockResolvedValue(null);

    const renderer = createRendererMock();
    const storage = createStorageMock();
    const service = buildService(prisma, createContextMock(), { renderer, storage });

    await expect(service.changeStatus("liq-1", { status: "ISSUED" })).rejects.toThrow(
      "La liquidación ya no se puede emitir."
    );

    // No es del ganador → cleanup.
    expect(storage.delete).toHaveBeenCalledWith("tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf");
  });

  it("si DocumentStorage.save falla, propaga error y NO llama a liquidation.update ni document.create", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(makeLiquidation() as never);
    mockTenantContext(prisma);
    const tx = mockChangeStatusTransaction(prisma);

    const renderer = createRendererMock();
    const storage = createStorageMock();
    storage.save.mockRejectedValueOnce(new Error("disk full"));
    const service = buildService(prisma, createContextMock(), { renderer, storage });

    await expect(service.changeStatus("liq-1", { status: "ISSUED" })).rejects.toThrow("disk full");

    expect(tx.document.create).not.toHaveBeenCalled();
    expect(tx.liquidation.updateMany).not.toHaveBeenCalled();
    // No se llega a abrir transaction.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("si la transaction falla (document.create), hace cleanup best-effort del storage", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(makeLiquidation() as never);
    mockTenantContext(prisma);

    // El callback de $transaction: updateMany ganador (count=1) y luego falla document.create.
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          liquidation: {
            update: vi.fn(),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn()
          },
          document: {
            create: vi.fn().mockRejectedValue(new Error("DB tx failed")),
            findFirst: vi.fn()
          },
          cashMovement: { create: vi.fn() }
        };
        return callback(tx);
      }
    );

    const renderer = createRendererMock();
    const storage = createStorageMock();
    const service = buildService(prisma, createContextMock(), { renderer, storage });

    await expect(service.changeStatus("liq-1", { status: "ISSUED" })).rejects.toThrow("DB tx failed");

    // Cleanup best-effort del archivo subido.
    expect(storage.delete).toHaveBeenCalledWith("tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf");
  });
});

describe("LiquidationsService — changeStatus (ISSUED → PAID)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ejecuta updateMany condicional con status=ISSUED y crea CashMovement OWNER_PAYOUT una sola vez (count=1)", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({
      status: "ISSUED",
      issuedAt: new Date("2026-04-30T12:00:00.000Z"),
      netAmount: "85000.00"
    });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    const tx = mockChangeStatusTransaction(prisma);
    tx.liquidation.updateMany.mockResolvedValue({ count: 1 });
    tx.liquidation.findUnique.mockResolvedValue({
      ...liquidation,
      status: "PAID",
      paidAt: new Date()
    });
    tx.cashMovement.create.mockResolvedValue({ id: "cm-1" });

    const service = buildService(prisma, createContextMock());

    await service.changeStatus("liq-1", { status: "PAID" });

    // updateMany condicional por status ISSUED (REQ-008, race-safe).
    expect(tx.liquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "liq-1", tenantId: "tenant-a", status: "ISSUED" },
        data: expect.objectContaining({ status: "PAID", paidAt: expect.any(Date) })
      })
    );
    expect(tx.cashMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.cashMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        type: "OWNER_PAYOUT",
        amount: "85000.00",
        currency: "ARS",
        sourceType: "LIQUIDATION",
        sourceId: "liq-1",
        paymentId: null,
        createdById: "user-1",
        occurredAt: expect.any(Date),
        reason: expect.stringContaining("liq-1")
      })
    });
  });

  it("ISSUED → PAID con count=0 y status post-reload PAID: idempotente, NO crea CashMovement", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ status: "ISSUED", netAmount: "85000.00" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    const tx = mockChangeStatusTransaction(prisma);
    tx.liquidation.updateMany.mockResolvedValue({ count: 0 });
    tx.liquidation.findUnique.mockResolvedValue({
      ...liquidation,
      status: "PAID",
      paidAt: new Date()
    });

    const service = buildService(prisma, createContextMock());

    const result = await service.changeStatus("liq-1", { status: "PAID" });

    expect(result.status).toBe("PAID");
    // Idempotencia concurrente: el ganador ya creó el movement.
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it("ISSUED → PAID con count=0 y status post-reload distinto: BadRequest 'La liquidación ya no se puede marcar como pagada.'", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ status: "ISSUED", netAmount: "85000.00" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    const tx = mockChangeStatusTransaction(prisma);
    tx.liquidation.updateMany.mockResolvedValue({ count: 0 });
    tx.liquidation.findUnique.mockResolvedValue({
      ...liquidation,
      status: "VOIDED",
      voidedAt: new Date()
    });

    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "PAID" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.changeStatus("liq-1", { status: "PAID" })).rejects.toThrow(
      "La liquidación ya no se puede marcar como pagada."
    );
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it("si la transaction falla, no se actualiza status ni se crea movement", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue(
      new Error("tx failed")
    );

    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "PAID" })).rejects.toThrow("tx failed");
  });

  it("idempotencia: PAID → PAID es noop, no llama a update ni crea CashMovement (REQ-008)", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ status: "PAID", paidAt: new Date(), netAmount: "85000.00" });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);
    const tx = mockChangeStatusTransaction(prisma);

    const service = buildService(prisma, createContextMock());

    const result = await service.changeStatus("liq-1", { status: "PAID" });

    expect(result.status).toBe("PAID");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.liquidation.update).not.toHaveBeenCalled();
    expect(tx.liquidation.updateMany).not.toHaveBeenCalled();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });
});

describe("LiquidationsService — changeStatus (transiciones inválidas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DRAFT → PAID rechaza con La transición de estado no es válida.", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "DRAFT" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "PAID" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changeStatus("liq-1", { status: "PAID" })).rejects.toThrow(
      "La transición de estado no es válida."
    );
  });

  it("DRAFT → DRAFT rechaza", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "DRAFT" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "DRAFT" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changeStatus("liq-1", { status: "DRAFT" })).rejects.toThrow(
      "La transición de estado no es válida."
    );
  });

  it("ISSUED → DRAFT rechaza", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "DRAFT" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("PAID → VOIDED rechaza con No se puede anular una liquidación pagada.", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "PAID" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(
      service.changeStatus("liq-1", { status: "VOIDED", voidReason: "test" })
    ).rejects.toThrow("No se puede anular una liquidación pagada.");
  });

  it("VOIDED → cualquier cosa rechaza", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "VOIDED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "ISSUED" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.changeStatus("liq-1", { status: "DRAFT" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe("LiquidationsService — changeStatus (VOID)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DRAFT → VOIDED con voidReason actualiza status + voidedAt + voidReason", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "DRAFT" }) as never
    );
    vi.mocked(prisma.liquidation.update).mockResolvedValue({
      ...makeLiquidation({ status: "VOIDED" }),
      voidedAt: new Date(),
      voidReason: "Error de carga"
    } as never);
    const service = buildService(prisma, createContextMock());

    await service.changeStatus("liq-1", { status: "VOIDED", voidReason: "Error de carga" });

    expect(prisma.liquidation.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      data: expect.objectContaining({
        status: "VOIDED",
        voidedAt: expect.any(Date),
        voidReason: "Error de carga"
      }),
      include: { lineItems: true, manualAdjustments: true }
    });
  });

  it("ISSUED → VOIDED con voidReason actualiza", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    vi.mocked(prisma.liquidation.update).mockResolvedValue(
      makeLiquidation({ status: "VOIDED", voidReason: "x" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await service.changeStatus("liq-1", { status: "VOIDED", voidReason: "Anulación pedida por owner" });

    expect(prisma.liquidation.update).toHaveBeenCalled();
  });

  it("DRAFT → VOIDED SIN voidReason rechaza", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "DRAFT" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-1", { status: "VOIDED" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.changeStatus("liq-1", { status: "VOIDED" })).rejects.toThrow(
      "Es necesario indicar un motivo de anulación."
    );
  });

  it("ISSUED → VOIDED con voidReason whitespace rechaza", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(
      service.changeStatus("liq-1", { status: "VOIDED", voidReason: "   " })
    ).rejects.toThrow("Es necesario indicar un motivo de anulación.");
  });
});

describe("LiquidationsService — changeStatus (NotFound + tenant scoping)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404 si la liquidación no existe", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock());

    await expect(service.changeStatus("liq-x", { status: "ISSUED" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("scopea por tenant: liquidación de otro tenant 404", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-other" }));

    await expect(service.changeStatus("liq-1", { status: "ISSUED" })).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-other" } },
      include: { lineItems: true, manualAdjustments: true }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addManualAdjustment (TASK-029)
// ─────────────────────────────────────────────────────────────────────────────

function mockAdjustmentTransaction(prisma: PrismaService) {
  const tx = {
    liquidationManualAdjustment: {
      create: vi.fn(),
      delete: vi.fn()
    },
    liquidation: { update: vi.fn() }
  };
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
  return tx;
}

describe("LiquidationsService — addManualAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DRAFT + CREDIT: crea adjustment, recalcula net (gross - commission + credit)", async () => {
    const prisma = createPrismaMock();
    // gross 100000, commission 10000, sin adjustments previos => net base 90000.
    // sumamos CREDIT 5000 => net 95000.
    const liquidation = makeLiquidation({
      grossAmount: "100000.00",
      commissionAmount: "10000.00",
      netAmount: "90000.00",
      manualAdjustments: []
    });
    // Primer findUnique al cargar; segundo findUnique al releer luego de la tx.
    vi.mocked(prisma.liquidation.findUnique)
      .mockResolvedValueOnce(liquidation as never)
      .mockResolvedValueOnce({
        ...liquidation,
        netAmount: "95000.00",
        manualAdjustments: [{ id: "adj-1", concept: "Bonificación", amount: "5000.00", sign: "CREDIT" }]
      } as never);
    const tx = mockAdjustmentTransaction(prisma);
    tx.liquidationManualAdjustment.create.mockResolvedValue({ id: "adj-1" });

    const service = buildService(prisma, createContextMock());

    await service.addManualAdjustment("liq-1", {
      concept: "Bonificación",
      amount: "5000.00",
      sign: "CREDIT"
    });

    expect(tx.liquidationManualAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        liquidationId: "liq-1",
        concept: "Bonificación",
        amount: "5000.00",
        sign: "CREDIT",
        createdById: "user-1"
      })
    });
    expect(tx.liquidation.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      data: { netAmount: "95000.00" }
    });
  });

  it("DRAFT + DEBIT: net se calcula como gross - commission - debit", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({
      grossAmount: "100000.00",
      commissionAmount: "10000.00",
      netAmount: "90000.00",
      manualAdjustments: []
    });
    vi.mocked(prisma.liquidation.findUnique)
      .mockResolvedValueOnce(liquidation as never)
      .mockResolvedValueOnce(liquidation as never);
    const tx = mockAdjustmentTransaction(prisma);
    tx.liquidationManualAdjustment.create.mockResolvedValue({ id: "adj-2" });

    const service = buildService(prisma, createContextMock());

    await service.addManualAdjustment("liq-1", {
      concept: "Reintegro",
      amount: "5000.00",
      sign: "DEBIT"
    });

    // 90000 - 5000 = 85000
    expect(tx.liquidation.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      data: { netAmount: "85000.00" }
    });
  });

  it("recalcula sumando TODOS los adjustments existentes + el nuevo", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({
      grossAmount: "100000.00",
      commissionAmount: "10000.00",
      netAmount: "92000.00", // gross - commission + 2000 (CREDIT existente)
      manualAdjustments: [{ id: "adj-prev", concept: "Bonus previo", amount: "2000.00", sign: "CREDIT" }]
    });
    vi.mocked(prisma.liquidation.findUnique)
      .mockResolvedValueOnce(liquidation as never)
      .mockResolvedValueOnce(liquidation as never);
    const tx = mockAdjustmentTransaction(prisma);
    tx.liquidationManualAdjustment.create.mockResolvedValue({ id: "adj-new" });

    const service = buildService(prisma, createContextMock());

    await service.addManualAdjustment("liq-1", {
      concept: "Descuento",
      amount: "1000.00",
      sign: "DEBIT"
    });

    // 90000 (gross-commission) + 2000 (CREDIT) - 1000 (DEBIT) = 91000
    expect(tx.liquidation.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      data: { netAmount: "91000.00" }
    });
  });

  it("rechaza si la liquidación está ISSUED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(
      service.addManualAdjustment("liq-1", { concept: "x", amount: "1.00", sign: "CREDIT" })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.addManualAdjustment("liq-1", { concept: "x", amount: "1.00", sign: "CREDIT" })
    ).rejects.toThrow("La liquidación debe estar en estado borrador para editar ajustes.");
  });

  it("rechaza si la liquidación está PAID", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "PAID" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(
      service.addManualAdjustment("liq-1", { concept: "x", amount: "1.00", sign: "CREDIT" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza si la liquidación está VOIDED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "VOIDED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(
      service.addManualAdjustment("liq-1", { concept: "x", amount: "1.00", sign: "CREDIT" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404 si la liquidación no existe", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock());

    await expect(
      service.addManualAdjustment("liq-x", { concept: "x", amount: "1.00", sign: "CREDIT" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("scopea por tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-z" }));

    await expect(
      service.addManualAdjustment("liq-1", { concept: "x", amount: "1.00", sign: "CREDIT" })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_tenantId: { id: "liq-1", tenantId: "tenant-z" } } })
    );
  });
});

describe("LiquidationsService — removeManualAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DRAFT: borra el adjustment y recalcula net excluyendo el removido", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({
      grossAmount: "100000.00",
      commissionAmount: "10000.00",
      netAmount: "92000.00", // gross - commission + 2000 (CREDIT)
      manualAdjustments: [{ id: "adj-1", concept: "Bonus", amount: "2000.00", sign: "CREDIT" }]
    });
    vi.mocked(prisma.liquidation.findUnique)
      .mockResolvedValueOnce(liquidation as never)
      .mockResolvedValueOnce({ ...liquidation, netAmount: "90000.00", manualAdjustments: [] } as never);
    const tx = mockAdjustmentTransaction(prisma);
    tx.liquidationManualAdjustment.delete.mockResolvedValue({ id: "adj-1" });

    const service = buildService(prisma, createContextMock());

    await service.removeManualAdjustment("liq-1", "adj-1");

    expect(tx.liquidationManualAdjustment.delete).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "adj-1", tenantId: "tenant-a" } }
    });
    // Tras remover el CREDIT 2000: net = 90000.
    expect(tx.liquidation.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "liq-1", tenantId: "tenant-a" } },
      data: { netAmount: "90000.00" }
    });
  });

  it("404 si el adjustment no existe en la liquidación", async () => {
    const prisma = createPrismaMock();
    const liquidation = makeLiquidation({ manualAdjustments: [] });
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(liquidation as never);

    const service = buildService(prisma, createContextMock());

    await expect(service.removeManualAdjustment("liq-1", "missing-adj")).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.removeManualAdjustment("liq-1", "missing-adj")).rejects.toThrow(
      "No encontramos el ajuste solicitado."
    );
  });

  it("rechaza si la liquidación está ISSUED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({
        status: "ISSUED",
        manualAdjustments: [{ id: "adj-1", concept: "x", amount: "1.00", sign: "CREDIT" }]
      }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.removeManualAdjustment("liq-1", "adj-1")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.removeManualAdjustment("liq-1", "adj-1")).rejects.toThrow(
      "La liquidación debe estar en estado borrador para editar ajustes."
    );
  });

  it("404 si el adjustment pertenece a OTRA liquidación (no figura en la lista)", async () => {
    const prisma = createPrismaMock();
    // El adjustment con id "adj-other" no figura en la lista de manualAdjustments
    // de esta liquidación, por lo tanto NotFound.
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({
        manualAdjustments: [{ id: "adj-mine", concept: "x", amount: "1.00", sign: "CREDIT" }]
      }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.removeManualAdjustment("liq-1", "adj-other")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("404 si la liquidación no existe", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock());

    await expect(service.removeManualAdjustment("liq-x", "adj-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("scopea por tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-foreign" }));

    await expect(service.removeManualAdjustment("liq-1", "adj-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_tenantId: { id: "liq-1", tenantId: "tenant-foreign" } } })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrGeneratePdf (TASK-031)
// ─────────────────────────────────────────────────────────────────────────────

describe("LiquidationsService — getOrGeneratePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza con BadRequest si la liquidación está en DRAFT", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "DRAFT" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.getOrGeneratePdf("liq-1")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getOrGeneratePdf("liq-1")).rejects.toThrow(
      "La liquidación todavía no está emitida."
    );
  });

  it("rechaza con BadRequest si la liquidación está VOIDED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "VOIDED" }) as never
    );
    const service = buildService(prisma, createContextMock());

    await expect(service.getOrGeneratePdf("liq-1")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getOrGeneratePdf("liq-1")).rejects.toThrow("La liquidación fue anulada.");
  });

  it("ISSUED con Document existente y archivo presente: devuelve stream sin regenerar", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-1",
      tenantId: "tenant-a",
      type: "LIQUIDATION",
      entityType: "Liquidation",
      entityId: "liq-1",
      storageKey: "tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf",
      fileName: "liquidacion-liq-1.pdf",
      mimeType: "application/pdf"
    } as never);

    const renderer = createRendererMock();
    const storage = createStorageMock();
    storage.exists.mockResolvedValue(true);
    storage.read.mockResolvedValue(Readable.from(Buffer.from("CACHED")));

    const service = buildService(prisma, createContextMock(), { renderer, storage });

    const result = await service.getOrGeneratePdf("liq-1");

    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.read).toHaveBeenCalledWith("tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf");
    expect(result.filename).toBe("liquidacion-liq-1.pdf");
    expect(result.mimeType).toBe("application/pdf");
  });

  it("ISSUED con Document existente pero archivo NO presente: regenera, guarda y devuelve stream", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-1",
      storageKey: "tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf",
      fileName: "liquidacion-liq-1.pdf",
      mimeType: "application/pdf"
    } as never);
    mockTenantContext(prisma);

    const renderer = createRendererMock();
    const storage = createStorageMock();
    storage.exists.mockResolvedValue(false);

    const service = buildService(prisma, createContextMock(), { renderer, storage });

    const result = await service.getOrGeneratePdf("liq-1");

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(result.filename).toBe("liquidacion-liq-1.pdf");
  });

  it("self-healing: si Document existe con storageKey distinto al computado, regenera en existingDoc.storageKey (no en el computado)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    // Document persistido con un storageKey legacy que NO coincide con `computePdfLocation`.
    const existingKey = "tenant-a/legacy/liq-1/snapshot.pdf";
    const existingFileName = "snapshot.pdf";
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-legacy",
      storageKey: existingKey,
      fileName: existingFileName,
      mimeType: "application/pdf"
    } as never);
    mockTenantContext(prisma);

    const renderer = createRendererMock();
    const storage = createStorageMock();
    storage.exists.mockResolvedValue(false);

    const service = buildService(prisma, createContextMock(), { renderer, storage });

    const result = await service.getOrGeneratePdf("liq-1");

    // REQ-012 self-healing: la regeneración usa el storageKey del Document, NO el computado.
    expect(storage.save).toHaveBeenCalledWith(existingKey, expect.anything());
    // Y se devuelve el filename del Document persistido.
    expect(result.filename).toBe(existingFileName);
    // No se crea un Document nuevo (el existente queda consistente).
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("ISSUED sin Document (fallback): genera, guarda, crea Document y devuelve stream", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "ISSUED" }) as never
    );
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.document.create).mockResolvedValue({ id: "doc-new" } as never);
    mockTenantContext(prisma);

    const renderer = createRendererMock();
    const storage = createStorageMock();

    const service = buildService(prisma, createContextMock(), { renderer, storage });

    const result = await service.getOrGeneratePdf("liq-1");

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        type: "LIQUIDATION",
        entityType: "Liquidation",
        entityId: "liq-1",
        fileName: "liquidacion-liq-1.pdf",
        mimeType: "application/pdf",
        storageKey: "tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf"
      })
    });
    expect(result.filename).toBe("liquidacion-liq-1.pdf");
  });

  it("PAID con Document presente: devuelve stream", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(
      makeLiquidation({ status: "PAID" }) as never
    );
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-1",
      storageKey: "tenant-a/liquidations/liq-1/liquidacion-liq-1.pdf",
      fileName: "liquidacion-liq-1.pdf",
      mimeType: "application/pdf"
    } as never);

    const renderer = createRendererMock();
    const storage = createStorageMock();
    storage.exists.mockResolvedValue(true);
    storage.read.mockResolvedValue(Readable.from(Buffer.from("CACHED")));

    const service = buildService(prisma, createContextMock(), { renderer, storage });

    const result = await service.getOrGeneratePdf("liq-1");

    expect(renderer.render).not.toHaveBeenCalled();
    expect(result.filename).toBe("liquidacion-liq-1.pdf");
  });

  it("404 si la liquidación no existe", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock());

    await expect(service.getOrGeneratePdf("liq-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("scopea por tenant del contexto", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.liquidation.findUnique).mockResolvedValue(null as never);
    const service = buildService(prisma, createContextMock({ tenantId: "tenant-other" }));

    await expect(service.getOrGeneratePdf("liq-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.liquidation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_tenantId: { id: "liq-1", tenantId: "tenant-other" } } })
    );
  });
});
