import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { ContractsService } from "./contracts.service";

function createPrismaMock() {
  return {
    property: {
      findFirst: vi.fn()
    },
    owner: {
      findFirst: vi.fn()
    },
    renter: {
      findFirst: vi.fn()
    },
    rentalContract: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  } as unknown as PrismaService;
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

const createInput = {
  propertyId: "property-1",
  ownerId: "owner-1",
  renterId: "renter-1",
  startsAt: "2026-05-01T00:00:00.000Z",
  endsAt: "2027-04-30T00:00:00.000Z",
  rentAmount: "100000.00",
  currency: "ARS" as const,
  dueDayOfMonth: 10,
  adjustmentIndexType: "ICL" as const,
  adjustmentPeriodMonths: 3
};

function mockValidRelations(prisma: PrismaService, tenantId = "tenant-a", ownerId = "owner-1") {
  vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId, ownerId } as never);
  vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: ownerId, tenantId } as never);
  vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId } as never);
}

describe("ContractsService", () => {
  it("checks property, owner, renter and active tenantId before creating contracts", async () => {
    const prisma = createPrismaMock();
    mockValidRelations(prisma, "tenant-a");
    vi.mocked(prisma.rentalContract.create).mockResolvedValue({ id: "contract-1", tenantId: "tenant-a" } as never);
    const service = new ContractsService(prisma, createContextMock("tenant-a"));

    await service.createContract(createInput);

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.renter.findFirst).toHaveBeenCalledWith({ where: { id: "renter-1", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.rentalContract.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", propertyId: "property-1", ownerId: "owner-1", renterId: "renter-1" })
    });
  });

  it("rejects contracts when the property does not belong to the selected owner", async () => {
    const prisma = createPrismaMock();
    mockValidRelations(prisma, "tenant-a", "owner-2");
    const service = new ContractsService(prisma, createContextMock("tenant-a"));

    await expect(service.createContract(createInput)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.rentalContract.create).not.toHaveBeenCalled();
  });

  it("lists contracts only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new ContractsService(prisma, createContextMock("tenant-b"));

    await service.listContracts();

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({ where: { tenantId: "tenant-b" }, orderBy: { startsAt: "desc" } });
  });

  it("lists active contracts only for status ACTIVE and the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new ContractsService(prisma, createContextMock("tenant-c"));

    await service.listActiveContracts();

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-c", status: "ACTIVE" },
      orderBy: { startsAt: "desc" }
    });
  });

  it("gets contracts by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ id: "contract-1", tenantId: "tenant-d" } as never);
    const service = new ContractsService(prisma, createContextMock("tenant-d"));

    await service.getContractById("contract-1");

    expect(prisma.rentalContract.findUnique).toHaveBeenCalledWith({ where: { id_tenantId: { id: "contract-1", tenantId: "tenant-d" } } });
  });

  it("updates contracts with compound id_tenantId and validates reassigned relations", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({
      id: "contract-1",
      tenantId: "tenant-e",
      propertyId: "property-1",
      ownerId: "owner-1",
      renterId: "renter-1"
    } as never);
    mockValidRelations(prisma, "tenant-e", "owner-2");
    vi.mocked(prisma.rentalContract.update).mockResolvedValue({ id: "contract-1", tenantId: "tenant-e", ownerId: "owner-2" } as never);
    const service = new ContractsService(prisma, createContextMock("tenant-e"));

    await service.updateContract("contract-1", { ownerId: "owner-2" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-e", deletedAt: null } });
    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-2", tenantId: "tenant-e", deletedAt: null } });
    expect(prisma.rentalContract.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-e" } },
      data: { ownerId: "owner-2" }
    });
  });

  it("changes contract status with compound id_tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.update).mockResolvedValue({ id: "contract-1", tenantId: "tenant-f", status: "ACTIVE" } as never);
    const service = new ContractsService(prisma, createContextMock("tenant-f"));

    await service.changeContractStatus("contract-1", "ACTIVE");

    expect(prisma.rentalContract.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-f" } },
      data: { status: "ACTIVE" }
    });
  });
});
