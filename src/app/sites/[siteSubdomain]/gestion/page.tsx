import { notFound } from "next/navigation";
import { todayInMexico } from "@/features/gym-platform/lib/calendar";
import { getGymManagementData, type GymTimeWindow } from "@/features/gym-platform/server/data";
import { GymAppHeader } from "@/features/gym-platform/ui/GymChrome";
import { GymCustomerStatusForm } from "@/features/gym-platform/ui/GymCustomerStatusForm";

const STATUS_LABELS = { lead: "Prospecto", active: "Activo", paused: "En pausa", cancelled: "Cancelado" } as const;
const DAY_LABELS: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
const TIME_LABELS: Record<GymTimeWindow, string> = { early: "antes de las 7", morning: "por la mañana", midday: "al mediodía", evening: "por la tarde", night: "por la noche" };

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export default async function GymManagementPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const data = await getGymManagementData(siteSubdomain);
  if (!data) notFound();
  const todayLabel = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${todayInMexico()}T12:00:00`));
  return (
    <div className="gym-management-app">
      <GymAppHeader area="manager" email={data.manager.email} />
      <div className="gym-management-shell">
        <aside className="gym-management-nav"><strong>ACTGym</strong><nav><a href="#overview" className="is-active">Panorama</a><a href="#bookings">Reservas</a><a href="#demand">Demanda</a><a href="#members">Socios</a><a href="#plans">Planes</a></nav><div><small>Sitio publicado</small><a href="/" target="_blank">Ver sitio ↗</a></div></aside>
        <main className="gym-management-main">
          <header id="overview" className="gym-management-heading"><div><p className="gym-kicker">{todayLabel}</p><h1>El gimnasio, hoy.</h1></div><div className={`gym-health-signal ${data.metrics.waitlistedCount ? "has-attention" : ""}`}><span />{data.metrics.waitlistedCount ? `${data.metrics.waitlistedCount} en lista de espera` : "Operación estable"}</div></header>
          <section className="gym-metrics" aria-label="Indicadores"><article><span>Socios activos</span><strong>{data.metrics.activeCustomers}</strong><small>de {data.metrics.totalCustomers} registros</small></article><article><span>Ingreso mensual</span><strong>{money(data.metrics.monthlyRevenueCents)}</strong><small>según planes activos</small></article><article><span>Ocupación próxima</span><strong>{data.metrics.occupancyPercent}%</strong><small>lugares confirmados</small></article><article><span>Prospectos</span><strong>{data.metrics.leads}</strong><small>por convertir</small></article></section>

          <section id="bookings" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Reservas</p><h2>Próximas sesiones</h2></div><span>Cupo y personas en tiempo real</span></div>
            <div className="gym-operations-calendar">
              {data.occurrences.map((occurrence) => {
                const occupancy = Math.round((occurrence.reservedCount / occurrence.capacity) * 100);
                return <article key={occurrence.key}>
                  <div className="gym-operation-date"><span>{formatDate(occurrence.classDate)}</span><strong>{occurrence.startTime}</strong></div>
                  <div className="gym-operation-main"><h3>{occurrence.name}</h3><p>Coach {occurrence.coach} · {occurrence.durationMinutes} min</p><div className="gym-occupancy-track"><span style={{ width: `${occupancy}%` }} /></div><small>{occurrence.reservedCount} de {occurrence.capacity} lugares · {occurrence.availableSpots} libres</small></div>
                  <div className="gym-operation-roster"><span>{occurrence.waitlistCount ? `${occurrence.waitlistCount} en espera` : "Sin espera"}</span><p>{occurrence.reservations.filter((reservation) => reservation.status === "reserved").slice(0, 3).map((reservation) => reservation.customerName).join(" · ") || "Aún sin reservas"}</p></div>
                </article>;
              })}
            </div>
          </section>

          <section id="demand" className="gym-management-section gym-demand-insights">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Demanda detectada</p><h2>Horarios que tus socios están pidiendo</h2></div><span>Meta: {data.site.scheduleInterestThreshold} personas</span></div>
            <div className="gym-demand-grid">
              {data.demands.length ? data.demands.map((demand) => <article key={demand.key} className={demand.ready ? "is-ready" : ""}><div><span>{DAY_LABELS[demand.weekday]} {TIME_LABELS[demand.timeWindow]}</span><h3>{demand.className}</h3></div><strong>{demand.requestCount}<small>/{demand.threshold}</small></strong><div className="gym-demand-track"><span style={{ width: `${Math.min((demand.requestCount / demand.threshold) * 100, 100)}%` }} /></div><p>{demand.ready ? "Demanda suficiente para probar este horario." : `Faltan ${demand.threshold - demand.requestCount} personas para activar la señal.`}</p><small>{demand.requesterNames.join(" · ")}</small></article>) : <div className="gym-empty-operation">Todavía no hay solicitudes. Las preferencias enviadas desde el portal aparecerán aquí.</div>}
            </div>
          </section>

          <section id="members" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Socios</p><h2>Personas y membresías</h2></div><span>{data.customers.length} registros</span></div>
            <div className="gym-customer-table" role="table" aria-label="Socios del gimnasio">
              <div className="gym-table-head" role="row"><span>Persona</span><span>Plan</span><span>Estado</span><span>Acción</span></div>
              {data.customers.map((customer) => <div className="gym-table-row" role="row" key={customer.id}><div><strong>{customer.name}</strong><small>{customer.email}</small></div><span>{customer.planName ?? "Sin plan"}</span><span className={`gym-customer-status is-${customer.status}`}>{STATUS_LABELS[customer.status]}</span><GymCustomerStatusForm subdomain={siteSubdomain} customerId={customer.id} status={customer.status} /></div>)}
            </div>
          </section>

          <section id="plans" className="gym-management-section"><div className="gym-management-section-head"><div><p className="gym-panel-label">Oferta</p><h2>Planes publicados</h2></div></div><div className="gym-manage-plans">{data.plans.map((plan) => <article key={plan.id}><div><strong>{plan.name}</strong><small>{plan.published ? "Visible en sitio" : "Borrador"}</small></div><span>{money(plan.priceCents)}</span></article>)}</div></section>
        </main>
      </div>
    </div>
  );
}
