import { DashboardSummary } from "../../components/dashboard/dashboard-summary";
import { AppShell } from "../../components/shared/app-shell";

export default function DashboardPage() {
  return (
    <AppShell tenantName="Vergani Propiedades">
      <DashboardSummary />
    </AppShell>
  );
}
