import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { RentersService } from "./renters.service";

function createPrismaMock() {
  return {
    renter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  } as unknown as PrismaService;
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

describe("RentersService", () => {
  it("creates renters with the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.create).mockResolvedValue({ id: "renter-1", tenantId: "tenant-a" } as never);
    const service = new RentersService(prisma, createContextMock("tenant-a"));

    await service.createRenter({ displayName: "Juan Pérez", identityNumber: "12345678" });

    expect(prisma.renter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", displayName: "Juan Pérez", identityNumber: "12345678" })
    });
  });

  it("lists renters only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findMany).mockResolvedValue([] as never);
    const service = new RentersService(prisma, createContextMock("tenant-b"));

    await service.listRenters();

    expect(prisma.renter.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { displayName: "asc" }
    });
  });

  it("gets renters by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId: "tenant-c" } as never);
    const service = new RentersService(prisma, createContextMock("tenant-c"));

    await service.getRenterById("renter-1");

    expect(prisma.renter.findFirst).toHaveBeenCalledWith({ where: { id: "renter-1", tenantId: "tenant-c", deletedAt: null } });
  });

  it("updates renters only after checking the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId: "tenant-d" } as never);
    vi.mocked(prisma.renter.update).mockResolvedValue({ id: "renter-1", tenantId: "tenant-d", displayName: "Nuevo nombre" } as never);
    const service = new RentersService(prisma, createContextMock("tenant-d"));

    await service.updateRenter("renter-1", { displayName: "Nuevo nombre" });

    expect(prisma.renter.findFirst).toHaveBeenCalledWith({ where: { id: "renter-1", tenantId: "tenant-d", deletedAt: null } });
    expect(prisma.renter.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "renter-1", tenantId: "tenant-d" } },
      data: { displayName: "Nuevo nombre" }
    });
  });
});
