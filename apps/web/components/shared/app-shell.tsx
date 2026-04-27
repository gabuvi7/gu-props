import type { ReactNode } from "react";

export function AppShell({ tenantName, children }: Readonly<{ tenantName: string; children: ReactNode }>) {
  return (
    <main style={{ minHeight: "100vh", padding: "32px" }}>
      <header style={{ marginBottom: "32px" }}>
        <strong>{tenantName}</strong>
        <p style={{ color: "var(--muted)", margin: "8px 0 0" }}>Espacio de trabajo con aislamiento por cliente</p>
      </header>
      {children}
    </main>
  );
}
