import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { PaymentsService } from "./payments.service";

type TxClient = {
  payment: { create: ReturnType<typeof vi.fn> };
  cashMovement: { create: ReturnType<typeof vi.fn> };
};

function createPrismaMock() {
  const tx: TxClient = {
    payment: { create: vi.fn() },
    cashMovement: { create: vi.fn() }
  };

  const prisma = {
    rentalContract: {
      findUnique: vi.fn()
    },
    payment: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    cashMovement: {
      findMany: vi.fn()
    },
    $transaction: vi.fn(async (fn: (client: TxClient) => unknown) => fn(tx))
  } as unknown as PrismaService & { __tx: TxClient };

  (prisma as unknown as { __tx: TxClient }).__tx = tx;
  return prisma as PrismaService & { __tx: TxClient };
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

const baseContract = {
  id: "contract-1",
  tenantId: "tenant-a",
  renterId: "renter-1",
  ownerId: "owner-1",
  propertyId: "property-1",
  currency: "ARS",
  status: "ACTIVE"
} as const;

const createInput = {
  contractId: "contract-1",
  renterId: "renter-1",
  dueAmount: "100000.00",
  paidAmount: "100000.00",
  currency: "ARS" as const,
  dueAt: "2026-05-10T00:00:00.000Z",
  paidAt: "2026-05-09T12:00:00.000Z"
};

describe("PaymentsService.createPayment", () => {
  it("creates Payment and CashMovement in the same transaction when paidAmount > 0", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-1", tenantId: "tenant-a" });
    prisma.__tx.cashMovement.create.mockResolvedValue({ id: "movement-1", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await service.createPayment(createInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        contractId: "contract-1",
        renterId: "renter-1",
        status: "PAID",
        dueAmount: "100000.00",
        paidAmount: "100000.00",
        remainingDebt: "0.00",
        creditBalance: "0.00",
        currency: "ARS"
      })
    });
    expect(prisma.__tx.cashMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        paymentId: "payment-1",
        type: "INCOME",
        amount: "100000.00",
        currency: "ARS",
        sourceType: "PAYMENT",
        sourceId: "payment-1"
      })
    });
  });

  it("creates only the Payment with status PENDING when paidAmount === 0 (no cash movement)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-2", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await service.createPayment({ ...createInput, paidAmount: "0", paidAt: undefined });

    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "PENDING", paidAmount: "0", remainingDebt: "100000.00", creditBalance: "0.00" })
    });
    expect(prisma.__tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it("rejects when the contract does not exist for the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await expect(service.createPayment(createInput)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the contract is CANCELLED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, status: "CANCELLED" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await expect(service.createPayment(createInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when the renterId does not match the contract renter", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, renterId: "other-renter" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await expect(service.createPayment(createInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when the currency does not match the contract currency", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, currency: "USD" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await expect(service.createPayment(createInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("derives PARTIAL status and remainingDebt when paidAmount < dueAmount", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-3", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await service.createPayment({ ...createInput, dueAmount: "100000.00", paidAmount: "60000.50" });

    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "PARTIAL", remainingDebt: "39999.50", creditBalance: "0.00" })
    });
  });

  it("derives OVERPAID status and creditBalance when paidAmount > dueAmount", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-4", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await service.createPayment({ ...createInput, dueAmount: "100000.00", paidAmount: "150000.00" });

    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "OVERPAID", remainingDebt: "0.00", creditBalance: "50000.00" })
    });
  });
});

describe("PaymentsService.listPayments", () => {
  it("filters by tenantId and contractId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-b"));

    await service.listPayments({ contractId: "contract-9" });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", contractId: "contract-9" },
      orderBy: { dueAt: "desc" }
    });
  });

  it("filters by tenantId and renterId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-c"));

    await service.listPayments({ renterId: "renter-9" });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-c", renterId: "renter-9" },
      orderBy: { dueAt: "desc" }
    });
  });
});

describe("PaymentsService.getContractBalance", () => {
  it("aggregates totals and excludes VOIDED payments from pendingDebt and creditBalance", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, currency: "ARS" } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { dueAmount: "100000.00", paidAmount: "60000.00", remainingDebt: "40000.00", creditBalance: "0.00", status: "PARTIAL" },
      { dueAmount: "100000.00", paidAmount: "100000.00", remainingDebt: "0.00", creditBalance: "0.00", status: "PAID" },
      { dueAmount: "100000.00", paidAmount: "50000.00", remainingDebt: "50000.00", creditBalance: "0.00", status: "VOIDED" }
    ] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    const balance = await service.getContractBalance("contract-1");

    expect(balance).toEqual(
      expect.objectContaining({
        contractId: "contract-1",
        currency: "ARS",
        totalDue: "300000.00",
        totalPaid: "210000.00",
        pendingDebt: "40000.00",
        creditBalance: "0.00"
      })
    );
    expect(balance.payments).toHaveLength(3);
  });

  it("rejects when the contract does not belong to the tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"));

    await expect(service.getContractBalance("contract-x")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("PaymentsService.getPaymentById", () => {
  it("looks up payments by id_tenantId and throws NotFound when missing", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-z"));

    await expect(service.getPaymentById("payment-x")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "payment-x", tenantId: "tenant-z" } }
    });
  });
});

describe("PaymentsService.listCashMovements", () => {
  it("filters cash movements by tenantId and date range", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-d"));

    await service.listCashMovements({ from: "2026-04-01T00:00:00.000Z", to: "2026-04-30T00:00:00.000Z" });

    expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-d",
        occurredAt: { gte: new Date("2026-04-01T00:00:00.000Z"), lte: new Date("2026-04-30T00:00:00.000Z") }
      },
      orderBy: { occurredAt: "desc" }
    });
  });

  it("rejects when from is greater than to", async () => {
    const prisma = createPrismaMock();
    const service = new PaymentsService(prisma, createContextMock("tenant-d"));

    await expect(
      service.listCashMovements({ from: "2026-05-30T00:00:00.000Z", to: "2026-05-01T00:00:00.000Z" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns all tenant movements when no range is provided", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-e"));

    await service.listCashMovements({});

    expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-e" },
      orderBy: { occurredAt: "desc" }
    });
  });
});
