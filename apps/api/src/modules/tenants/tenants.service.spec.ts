import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import { TenantsService } from "./tenants.service";

function createPrismaMock() {
  return {
    tenant: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  } as unknown as PrismaService;
}

describe("TenantsService", () => {
  it("creates a tenant with settings", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.create).mockResolvedValue({ id: "tenant-1" } as never);
    const service = new TenantsService(prisma);

    await service.createTenant({
      name: "Inmobiliaria Sur",
      slug: "inmobiliaria-sur",
      settings: {
        commercialName: "Inmobiliaria Sur",
        defaultCurrency: "ARS",
        defaultCommissionBps: 0
      }
    });

    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Inmobiliaria Sur",
          slug: "inmobiliaria-sur",
          settings: { create: expect.objectContaining({ commercialName: "Inmobiliaria Sur" }) }
        }),
        include: { settings: true }
      })
    );
  });

  it("lists tenants with settings", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([] as never);
    const service = new TenantsService(prisma);

    await service.listTenants();

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({ include: { settings: true }, orderBy: { createdAt: "desc" } });
  });

  it("gets a tenant by id with settings", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
    const service = new TenantsService(prisma);

    await service.getTenantById("tenant-1");

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: "tenant-1" }, include: { settings: true } });
  });
});
