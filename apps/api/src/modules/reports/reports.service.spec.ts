import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { ReportsService } from "./reports.service";

function createPrismaMock() {
  return {
    renter: {
      findUnique: vi.fn()
    },
    rentalContract: {
      findMany: vi.fn()
    },
    payment: {
      findMany: vi.fn()
    },
    cashMovement: {
      findMany: vi.fn()
    }
  } as unknown as PrismaService;
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

describe("ReportsService.getRenterHistory", () => {
  it("returns full history for a renter belonging to the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findUnique).mockResolvedValue({
      id: "renter-1",
      tenantId: "tenant-a",
      displayName: "Mariano Pérez",
      email: "mariano@example.com",
      phone: "+5491100000000",
      deletedAt: null
    } as never);
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "contract-1",
        propertyId: "prop-1",
        status: "ACTIVE",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2027-01-01T00:00:00.000Z"),
        currency: "ARS",
        rentAmount: "100000.00"
      }
    ] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: "p1",
        currency: "ARS",
        status: "PAID",
        dueAmount: "100000.00",
        paidAmount: "100000.00",
        remainingDebt: "0.00",
        creditBalance: "0.00"
      },
      {
        id: "p2",
        currency: "ARS",
        status: "PARTIAL",
        dueAmount: "100000.00",
        paidAmount: "60000.00",
        remainingDebt: "40000.00",
        creditBalance: "0.00"
      }
    ] as never);

    const service = new ReportsService(prisma, createContextMock("tenant-a"));
    const result = await service.getRenterHistory("renter-1");

    expect(prisma.renter.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "renter-1", tenantId: "tenant-a" } }
    });
    expect(result.renter.displayName).toBe("Mariano Pérez");
    expect(result.contracts).toHaveLength(1);
    expect(result.payments).toHaveLength(2);
    expect(result.totals).toEqual({
      currency: "ARS",
      totalDue: "200000.00",
      totalPaid: "160000.00",
      pendingDebt: "40000.00",
      creditBalance: "0.00"
    });
  });

  it("throws NotFound when the renter does not exist for the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findUnique).mockResolvedValue(null);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    await expect(service.getRenterHistory("renter-x")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFound when the renter is soft-deleted", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findUnique).mockResolvedValue({
      id: "renter-1",
      tenantId: "tenant-a",
      displayName: "Borrado",
      email: null,
      phone: null,
      deletedAt: new Date()
    } as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    await expect(service.getRenterHistory("renter-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("aggregates totals only for the dominant currency when payments mix currencies", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findUnique).mockResolvedValue({
      id: "renter-1",
      tenantId: "tenant-a",
      displayName: "Mixta",
      email: null,
      phone: null,
      deletedAt: null
    } as never);
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "contract-1",
        propertyId: "prop-1",
        status: "ACTIVE",
        startsAt: new Date(),
        endsAt: new Date(),
        currency: "USD",
        rentAmount: "1000.00"
      }
    ] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", currency: "USD", status: "PAID", dueAmount: "1000.00", paidAmount: "1000.00", remainingDebt: "0.00", creditBalance: "0.00" },
      { id: "p2", currency: "ARS", status: "PARTIAL", dueAmount: "100000.00", paidAmount: "10000.00", remainingDebt: "90000.00", creditBalance: "0.00" }
    ] as never);

    const service = new ReportsService(prisma, createContextMock("tenant-a"));
    const result = await service.getRenterHistory("renter-1");

    expect(result.totals).toEqual({
      currency: "USD",
      totalDue: "1000.00",
      totalPaid: "1000.00",
      pendingDebt: "0.00",
      creditBalance: "0.00"
    });
  });
});

describe("ReportsService.getUpcomingDuePayments", () => {
  it("filters by tenant, status PENDING/PARTIAL and date range, ordered ascending by dueAt", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-b"));

    await service.getUpcomingDuePayments({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-b",
        status: { in: ["PENDING", "PARTIAL"] },
        dueAt: { gte: new Date("2026-04-01T00:00:00.000Z"), lte: new Date("2026-04-30T23:59:59.999Z") }
      },
      include: { contract: { select: { id: true, propertyId: true, renterId: true, ownerId: true } } },
      orderBy: { dueAt: "asc" }
    });
  });

  it("applies optional filters (contractId, renterId, propertyId via contract relation)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-c"));

    await service.getUpcomingDuePayments({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T00:00:00.000Z",
      contractId: "contract-9",
      renterId: "renter-9",
      propertyId: "prop-9"
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-c",
        status: { in: ["PENDING", "PARTIAL"] },
        dueAt: { gte: new Date("2026-04-01T00:00:00.000Z"), lte: new Date("2026-04-30T00:00:00.000Z") },
        contractId: "contract-9",
        renterId: "renter-9",
        contract: { propertyId: "prop-9" }
      },
      include: { contract: { select: { id: true, propertyId: true, renterId: true, ownerId: true } } },
      orderBy: { dueAt: "asc" }
    });
  });

  it("rejects when from is greater than to", async () => {
    const prisma = createPrismaMock();
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    await expect(
      service.getUpcomingDuePayments({ from: "2026-05-30T00:00:00.000Z", to: "2026-05-01T00:00:00.000Z" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("uses a default range of today + 30 days when no from/to is provided", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const before = Date.now();
    const result = await service.getUpcomingDuePayments({});
    const after = Date.now();

    const fromMs = Date.parse(result.from);
    const toMs = Date.parse(result.to);
    expect(toMs - fromMs).toBe(30 * 24 * 60 * 60 * 1000);
    // from se normaliza al inicio del día UTC, así que debe ser <= ahora.
    expect(fromMs).toBeLessThanOrEqual(after);
    expect(fromMs + 24 * 60 * 60 * 1000).toBeGreaterThan(before);
  });

  it("returns total count and serializes from/to as ISO strings", async () => {
    const prisma = createPrismaMock();
    const sample = [
      { id: "pay-1", dueAt: new Date("2026-04-05T00:00:00.000Z"), contract: { id: "c1", propertyId: "p1", renterId: "r1", ownerId: "o1" } },
      { id: "pay-2", dueAt: new Date("2026-04-10T00:00:00.000Z"), contract: { id: "c1", propertyId: "p1", renterId: "r1", ownerId: "o1" } }
    ];
    vi.mocked(prisma.payment.findMany).mockResolvedValue(sample as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getUpcomingDuePayments({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T00:00:00.000Z"
    });

    expect(result.total).toBe(2);
    expect(result.from).toBe("2026-04-01T00:00:00.000Z");
    expect(result.to).toBe("2026-04-30T00:00:00.000Z");
    expect(result.payments).toHaveLength(2);
  });
});

describe("ReportsService.getCashFlow", () => {
  it("aggregates totals by type for a given month and computes net = income - expense - ownerPayout", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([
      { id: "m1", type: "INCOME", amount: "100000.00", currency: "ARS", occurredAt: new Date("2026-04-05T00:00:00.000Z") },
      { id: "m2", type: "INCOME", amount: "50000.00", currency: "ARS", occurredAt: new Date("2026-04-10T00:00:00.000Z") },
      { id: "m3", type: "EXPENSE", amount: "20000.00", currency: "ARS", occurredAt: new Date("2026-04-15T00:00:00.000Z") },
      { id: "m4", type: "COMMISSION", amount: "15000.00", currency: "ARS", occurredAt: new Date("2026-04-16T00:00:00.000Z") },
      { id: "m5", type: "OWNER_PAYOUT", amount: "30000.00", currency: "ARS", occurredAt: new Date("2026-04-20T00:00:00.000Z") },
      { id: "m6", type: "ADJUSTMENT", amount: "1000.00", currency: "ARS", occurredAt: new Date("2026-04-21T00:00:00.000Z") }
    ] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getCashFlow({ month: "2026-04" });

    expect(result.month).toBe("2026-04");
    expect(result.currency).toBe("ARS");
    expect(result.totals).toEqual({
      income: "150000.00",
      expense: "20000.00",
      commission: "15000.00",
      ownerPayout: "30000.00",
      adjustment: "1000.00",
      // 150000 - 20000 - 30000 = 100000
      net: "100000.00"
    });
    expect(result.movementsByType).toEqual({
      INCOME: 2,
      EXPENSE: 1,
      COMMISSION: 1,
      OWNER_PAYOUT: 1,
      ADJUSTMENT: 1
    });
  });

  it("queries the right month range (UTC start/end of month)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-z"));

    await service.getCashFlow({ month: "2026-02" });

    expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-z",
        occurredAt: {
          gte: new Date(Date.UTC(2026, 1, 1, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(2026, 2, 0, 23, 59, 59, 999))
        }
      },
      orderBy: { occurredAt: "asc" }
    });
  });

  it("returns zero totals (formatted '0.00') when there are no movements", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getCashFlow({ month: "2026-04" });

    expect(result.totals).toEqual({
      income: "0.00",
      expense: "0.00",
      commission: "0.00",
      ownerPayout: "0.00",
      adjustment: "0.00",
      net: "0.00"
    });
    expect(result.currency).toBe("ARS");
    expect(result.movementsByType).toEqual({ INCOME: 0, EXPENSE: 0, COMMISSION: 0, OWNER_PAYOUT: 0, ADJUSTMENT: 0 });
  });

  it("forces ARS when movements mix currencies (multi-currency MVP)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([
      { id: "m1", type: "INCOME", amount: "100000.00", currency: "ARS", occurredAt: new Date() },
      { id: "m2", type: "INCOME", amount: "1000.00", currency: "USD", occurredAt: new Date() }
    ] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getCashFlow({ month: "2026-04" });

    expect(result.currency).toBe("ARS");
  });
});

describe("ReportsService.getOutstandingBalances", () => {
  it("returns only contracts with pendingDebt > 0, sorted desc", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "c1",
        propertyId: "p1",
        renterId: "r1",
        ownerId: "o1",
        currency: "ARS",
        property: { addressLine: "Av. Corrientes 1234" },
        renter: { displayName: "Inquilino Uno" },
        payments: [
          { status: "PARTIAL", remainingDebt: "20000.00", dueAt: new Date("2026-03-01T00:00:00.000Z"), currency: "ARS" },
          { status: "PENDING", remainingDebt: "30000.00", dueAt: new Date("2026-05-01T00:00:00.000Z"), currency: "ARS" }
        ]
      },
      {
        id: "c2",
        propertyId: "p2",
        renterId: "r2",
        ownerId: "o2",
        currency: "ARS",
        property: { addressLine: "Calle Falsa 123" },
        renter: { displayName: "Inquilino Dos" },
        payments: [
          { status: "PENDING", remainingDebt: "100000.00", dueAt: new Date("2026-04-15T00:00:00.000Z"), currency: "ARS" }
        ]
      },
      {
        id: "c3",
        propertyId: "p3",
        renterId: "r3",
        ownerId: "o3",
        currency: "ARS",
        property: { addressLine: "Sin deuda 1" },
        renter: { displayName: "Inquilino Tres" },
        payments: [
          { status: "PAID", remainingDebt: "0.00", dueAt: new Date("2026-04-15T00:00:00.000Z"), currency: "ARS" }
        ]
      }
    ] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getOutstandingBalances({ asOf: "2026-04-01T00:00:00.000Z" });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.contractId)).toEqual(["c2", "c1"]);
    const c1 = result.items.find((item) => item.contractId === "c1")!;
    expect(c1.pendingDebt).toBe("50000.00");
    expect(c1.overduePaymentsCount).toBe(1); // sólo el del 2026-03 está vencido respecto a asOf 2026-04-01
    expect(c1.nextDueAt).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    expect(c1.renterName).toBe("Inquilino Uno");
    expect(c1.propertyAddress).toBe("Av. Corrientes 1234");
  });

  it("applies optional filters (propertyId, ownerId)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-d"));

    await service.getOutstandingBalances({
      propertyId: "prop-7",
      ownerId: "owner-7",
      asOf: "2026-04-01T00:00:00.000Z"
    });

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-d", propertyId: "prop-7", ownerId: "owner-7" },
      include: {
        property: { select: { addressLine: true } },
        renter: { select: { displayName: true } },
        payments: { where: { tenantId: "tenant-d" }, orderBy: { dueAt: "asc" } }
      }
    });
  });

  it("excludes VOIDED payments from pendingDebt calculation", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "c1",
        propertyId: "p1",
        renterId: "r1",
        ownerId: "o1",
        currency: "ARS",
        property: { addressLine: "X" },
        renter: { displayName: "Y" },
        payments: [
          { status: "VOIDED", remainingDebt: "50000.00", dueAt: new Date("2026-03-01T00:00:00.000Z"), currency: "ARS" },
          { status: "PARTIAL", remainingDebt: "10000.00", dueAt: new Date("2026-05-01T00:00:00.000Z"), currency: "ARS" }
        ]
      }
    ] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getOutstandingBalances({ asOf: "2026-04-01T00:00:00.000Z" });

    expect(result.items[0].pendingDebt).toBe("10000.00");
  });

  it("computes nextDueAt as the earliest open payment with dueAt >= asOf", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "c1",
        propertyId: "p1",
        renterId: "r1",
        ownerId: "o1",
        currency: "ARS",
        property: { addressLine: "X" },
        renter: { displayName: "Y" },
        payments: [
          { status: "PARTIAL", remainingDebt: "5000.00", dueAt: new Date("2026-06-15T00:00:00.000Z"), currency: "ARS" },
          { status: "PENDING", remainingDebt: "5000.00", dueAt: new Date("2026-04-15T00:00:00.000Z"), currency: "ARS" },
          { status: "PENDING", remainingDebt: "5000.00", dueAt: new Date("2026-05-01T00:00:00.000Z"), currency: "ARS" }
        ]
      }
    ] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getOutstandingBalances({ asOf: "2026-04-20T00:00:00.000Z" });

    expect(result.items[0].overduePaymentsCount).toBe(1);
    expect(result.items[0].nextDueAt).toEqual(new Date("2026-05-01T00:00:00.000Z"));
  });

  it("excludes contracts whose remaining debt is zero", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "c1",
        propertyId: "p1",
        renterId: "r1",
        ownerId: "o1",
        currency: "ARS",
        property: { addressLine: "X" },
        renter: { displayName: "Y" },
        payments: [
          { status: "PAID", remainingDebt: "0.00", dueAt: new Date("2026-04-01T00:00:00.000Z"), currency: "ARS" }
        ]
      }
    ] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const result = await service.getOutstandingBalances({});

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("uses now as default asOf when omitted", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new ReportsService(prisma, createContextMock("tenant-a"));

    const before = Date.now();
    const result = await service.getOutstandingBalances({});
    const after = Date.now();

    const asOfMs = Date.parse(result.asOf);
    expect(asOfMs).toBeGreaterThanOrEqual(before);
    expect(asOfMs).toBeLessThanOrEqual(after);
  });
});
