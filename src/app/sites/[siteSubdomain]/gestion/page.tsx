import { notFound } from "next/navigation";
import { getGymManagementData } from "@/features/gym-platform/server/data";
import { GymAppHeader } from "@/features/gym-platform/ui/GymChrome";
import { GymCustomerStatusForm } from "@/features/gym-platform/ui/GymCustomerStatusForm";

const STATUS_LABELS = { lead: "Prospecto", active: "Activo", paused: "En pausa", cancelled: "Cancelado" } as const;
const DAY_LABELS: Record<number, string> = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function GymManagementPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const data = await getGymManagementData(siteSubdomain);
  if (!data) notFound();
  return (
    <div className="gym-management-app">
      <GymAppHeader area="manager" email={data.manager.email} />
      <div className="gym-management-shell">
        <aside className="gym-management-nav"><strong>ACTGym</strong><nav><a href="#overview" className="is-active">Panorama</a><a href="#members">Socios</a><a href="#schedule">Agenda</a><a href="#plans">Planes</a></nav><div><small>Sitio publicado</small><a href="/" target="_blank">Ver sitio ↗</a></div></aside>
        <main className="gym-management-main">
          <header id="overview" className="gym-management-heading"><div><p className="gym-kicker">Lunes 24 de agosto</p><h1>El gimnasio, hoy.</h1></div><div className="gym-health-signal"><span />Operación estable</div></header>
          <section className="gym-metrics" aria-label="Indicadores"><article><span>Socios activos</span><strong>{data.metrics.activeCustomers}</strong><small>de {data.metrics.totalCustomers} registros</small></article><article><span>Ingreso mensual</span><strong>{money(data.metrics.monthlyRevenueCents)}</strong><small>según planes activos</small></article><article><span>Prospectos</span><strong>{data.metrics.leads}</strong><small>por convertir</small></article><article><span>Clases / semana</span><strong>{data.classes.reduce((sum, gymClass) => sum + gymClass.weekdays.length, 0)}</strong><small>{data.classes.length} formatos</small></article></section>

          <section id="members" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Socios</p><h2>Personas y membresías</h2></div><span>{data.customers.length} registros</span></div>
            <div className="gym-customer-table" role="table" aria-label="Socios del gimnasio">
              <div className="gym-table-head" role="row"><span>Persona</span><span>Plan</span><span>Estado</span><span>Acción</span></div>
              {data.customers.map((customer) => <div className="gym-table-row" role="row" key={customer.id}><div><strong>{customer.name}</strong><small>{customer.email}</small></div><span>{customer.planName ?? "Sin plan"}</span><span className={`gym-customer-status is-${customer.status}`}>{STATUS_LABELS[customer.status]}</span><GymCustomerStatusForm subdomain={siteSubdomain} customerId={customer.id} status={customer.status} /></div>)}
            </div>
          </section>

          <div className="gym-management-columns">
            <section id="schedule" className="gym-management-section"><div className="gym-management-section-head"><div><p className="gym-panel-label">Agenda</p><h2>Clases base</h2></div></div><div className="gym-manage-classes">{data.classes.map((gymClass) => <article key={gymClass.id}><time>{gymClass.startTime}</time><div><strong>{gymClass.name}</strong><small>{gymClass.weekdays.map((day) => DAY_LABELS[day]).join(" · ")} · {gymClass.coach}</small></div><span>{gymClass.capacity} lugares</span></article>)}</div></section>
            <section id="plans" className="gym-management-section"><div className="gym-management-section-head"><div><p className="gym-panel-label">Oferta</p><h2>Planes publicados</h2></div></div><div className="gym-manage-plans">{data.plans.map((plan) => <article key={plan.id}><div><strong>{plan.name}</strong><small>{plan.published ? "Visible en sitio" : "Borrador"}</small></div><span>{money(plan.priceCents)}</span></article>)}</div></section>
          </div>
        </main>
      </div>
    </div>
  );
}
