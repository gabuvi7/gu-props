import { describe, expect, it } from "vitest";
import { TenantAwareRepository, type TenantAwareDelegate, type TenantScopedRecord } from "./tenant-aware.repository";

type OwnerRecord = TenantScopedRecord & { displayName: string };

function createDelegate(records: OwnerRecord[]) {
  const calls: Array<{ where: Record<string, unknown> }> = [];
  const delegate: TenantAwareDelegate<OwnerRecord> = {
    async findFirst(args) {
      calls.push(args);
      return records.find((record) => record.id === args.where.id && record.tenantId === args.where.tenantId) ?? null;
    },
    async findMany(args) {
      calls.push(args);
      return records.filter((record) => record.tenantId === args.where.tenantId);
    }
  };

  return { delegate, calls };
}

describe("TenantAwareRepository", () => {
  it("finds records by id and tenantId, never by id alone", async () => {
    const { delegate, calls } = createDelegate([
      { id: "owner-1", tenantId: "tenant-a", displayName: "Tenant A owner" },
      { id: "owner-1", tenantId: "tenant-b", displayName: "Tenant B owner" }
    ]);
    const repository = new TenantAwareRepository(delegate, {
      get: () => ({ requestId: "req-1", userId: "user-1", tenantId: "tenant-b", role: "OWNER" })
    });

    const result = await repository.findById("owner-1");

    expect(result?.displayName).toBe("Tenant B owner");
    expect(calls[0]?.where).toEqual({ id: "owner-1", tenantId: "tenant-b" });
  });

  it("returns null when the id exists only in another tenant", async () => {
    const { delegate } = createDelegate([{ id: "owner-1", tenantId: "tenant-a", displayName: "Tenant A owner" }]);
    const repository = new TenantAwareRepository(delegate, {
      get: () => ({ requestId: "req-1", userId: "user-1", tenantId: "tenant-b", role: "OWNER" })
    });

    await expect(repository.findById("owner-1")).resolves.toBeNull();
  });
});
