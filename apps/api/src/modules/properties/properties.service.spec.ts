import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { PropertiesService } from "./properties.service";

function createPrismaMock() {
  return {
    owner: {
      findFirst: vi.fn()
    },
    property: {
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

describe("PropertiesService", () => {
  it("checks owner id and active tenantId before creating properties", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.property.create).mockResolvedValue({ id: "property-1", tenantId: "tenant-a", ownerId: "owner-1" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"));

    await service.createProperty({ ownerId: "owner-1", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" });

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", ownerId: "owner-1", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" })
    });
  });

  it("lists properties only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-b"));

    await service.listProperties();

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { addressLine: "asc" }
    });
  });

  it("gets properties by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-c" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-c"));

    await service.getPropertyById("property-1");

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-c", deletedAt: null } });
  });

  it("updates properties with compound id_tenantId after checking active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", ownerId: "owner-1" } as never);
    vi.mocked(prisma.property.update).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", addressLine: "Nueva dirección" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"));

    await service.updateProperty("property-1", { addressLine: "Nueva dirección" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-d", deletedAt: null } });
    expect(prisma.property.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "property-1", tenantId: "tenant-d" } },
      data: { addressLine: "Nueva dirección" }
    });
  });

  it("checks new owner id and active tenantId before reassigning properties", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-e", ownerId: "owner-1" } as never);
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-2", tenantId: "tenant-e" } as never);
    vi.mocked(prisma.property.update).mockResolvedValue({ id: "property-1", tenantId: "tenant-e", ownerId: "owner-2" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-e"));

    await service.updateProperty("property-1", { ownerId: "owner-2" });

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-2", tenantId: "tenant-e", deletedAt: null } });
    expect(prisma.property.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "property-1", tenantId: "tenant-e" } },
      data: { ownerId: "owner-2" }
    });
  });
});
