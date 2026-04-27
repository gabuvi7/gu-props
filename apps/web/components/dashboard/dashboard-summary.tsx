import { StatusCard } from "../ui/status-card";

const firstSliceMetrics = [
  { label: "Clientes", value: "1 piloto" },
  { label: "Módulos principales", value: "7 estructuras base" },
  { label: "Aislamiento", value: "ID + cliente" }
] as const;

export function DashboardSummary() {
  return (
    <section>
      <h1>Panel operativo</h1>
      <p style={{ color: "var(--muted)" }}>Base del servidor lista para mostrar datos reales más adelante.</p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {firstSliceMetrics.map((metric) => (
          <StatusCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
    </section>
  );
}
