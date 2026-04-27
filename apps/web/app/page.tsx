import Link from "next/link";
import { AppShell } from "../components/shared/app-shell";

export default function LandingPage() {
  return (
    <AppShell tenantName="GU-Props">
      <section className="hero">
        <p className="eyebrow">Base SaaS multi-cliente</p>
        <h1>Gestión inmobiliaria con aislamiento por cliente desde el día uno.</h1>
        <p>
          Primer módulo base para propietarios, inquilinos, propiedades, contratos, pagos, caja, liquidaciones y auditoría.
        </p>
        <Link href="/dashboard">Ir al panel</Link>
      </section>
    </AppShell>
  );
}
