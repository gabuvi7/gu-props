import { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  tenant: (tenantId: string) => ["tenant", tenantId] as const,
  owners: (tenantId: string) => ["owners", tenantId] as const,
  renters: (tenantId: string) => ["renters", tenantId] as const,
  properties: (tenantId: string) => ["properties", tenantId] as const,
  contracts: (tenantId: string) => ["contracts", tenantId] as const,
  payments: (tenantId: string) => ["payments", tenantId] as const,
  liquidations: (tenantId: string) => ["liquidations", tenantId] as const
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false
      }
    }
  });
}
