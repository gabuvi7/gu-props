import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { OwnersService } from "./owners.service";

function createPrismaMock() {
  return {
    owner: {
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

describe("OwnersService", () => {
  it("creates owners with the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.create).mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never);
    const service = new OwnersService(prisma, createContextMock("tenant-a"));

    await service.createOwner({ displayName: "Ana Gómez", email: "ana@example.com" });

    expect(prisma.owner.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", displayName: "Ana Gómez", email: "ana@example.com" })
    });
  });

  it("lists owners only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findMany).mockResolvedValue([] as never);
    const service = new OwnersService(prisma, createContextMock("tenant-b"));

    await service.listOwners();

    expect(prisma.owner.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { displayName: "asc" }
    });
  });

  it("gets owners by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-c" } as never);
    const service = new OwnersService(prisma, createContextMock("tenant-c"));

    await service.getOwnerById("owner-1");

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-c", deletedAt: null } });
  });

  it("updates owners only after checking the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-d" } as never);
    vi.mocked(prisma.owner.update).mockResolvedValue({ id: "owner-1", tenantId: "tenant-d", displayName: "Nuevo nombre" } as never);
    const service = new OwnersService(prisma, createContextMock("tenant-d"));

    await service.updateOwner("owner-1", { displayName: "Nuevo nombre" });

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-d", deletedAt: null } });
    expect(prisma.owner.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "owner-1", tenantId: "tenant-d" } },
      data: { displayName: "Nuevo nombre" }
    });
  });
});
