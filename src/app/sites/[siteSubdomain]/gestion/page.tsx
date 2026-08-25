import { notFound } from "next/navigation";
import { todayInMexico } from "@/features/gym-platform/lib/calendar";
import { getGymManagementData, type GymTimeWindow } from "@/features/gym-platform/server/data";
import { GymAppHeader } from "@/features/gym-platform/ui/GymChrome";
import { GymCustomerStatusForm } from "@/features/gym-platform/ui/GymCustomerStatusForm";
import { GymDemandApprovalForm } from "@/features/gym-platform/ui/GymDemandApprovalForm";
import { GymCashForm } from "@/features/gym-platform/ui/GymCashForm";
import { GymCatalogItemForm } from "@/features/gym-platform/ui/GymCatalogItemForm";
import { GymInventoryForm } from "@/features/gym-platform/ui/GymInventoryForm";
import { GymOperationsSettingsForm } from "@/features/gym-platform/ui/GymOperationsSettingsForm";
import { GymPlanSettingsForm } from "@/features/gym-platform/ui/GymPlanSettingsForm";
import { GymPOSForm } from "@/features/gym-platform/ui/GymPOSForm";

const STATUS_LABELS = { lead: "Prospecto", active: "Activo", paused: "En pausa", cancelled: "Cancelado" } as const;
const DAY_LABELS: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
const TIME_LABELS: Record<GymTimeWindow, string> = { early: "antes de las 7", morning: "por la mañana", midday: "al mediodía", evening: "por la tarde", night: "por la noche" };
const PAYMENT_LABELS = { cash: "Efectivo", card: "Tarjeta", bank_transfer: "Transferencia", mercado_pago: "Mercado Pago" } as const;

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
        <aside className="gym-management-nav"><strong>ACTGym</strong><nav><a href="#overview" className="is-active">Panorama</a><a href="#pos">Punto de venta</a><a href="#payments">Cobros</a><a href="#inventory">Inventario</a><a href="#bookings">Reservas</a><a href="#demand">Demanda</a><a href="#members">Socios</a><a href="#plans">Planes</a><a href="#settings">Configuración</a></nav><div><small>Sitio publicado</small><a href="/" target="_blank">Ver sitio ↗</a></div></aside>
        <main className="gym-management-main">
          <header id="overview" className="gym-management-heading"><div><p className="gym-kicker">{todayLabel}</p><h1>El gimnasio, hoy.</h1></div><div className={`gym-health-signal ${data.metrics.waitlistedCount ? "has-attention" : ""}`}><span />{data.metrics.waitlistedCount ? `${data.metrics.waitlistedCount} en lista de espera` : "Operación estable"}</div></header>
          <section className="gym-metrics" aria-label="Indicadores"><article><span>Socios activos</span><strong>{data.metrics.activeCustomers}</strong><small>de {data.metrics.totalCustomers} registros</small></article><article><span>Cobrado este mes</span><strong>{money(data.metrics.collectedThisMonthCents)}</strong><small>{data.metrics.salesThisMonth} ventas conciliables</small></article><article><span>Ocupación próxima</span><strong>{data.metrics.occupancyPercent}%</strong><small>lugares confirmados</small></article><article><span>Inventario</span><strong>{data.metrics.lowStockItems}</strong><small>productos con existencia baja</small></article></section>

          <section id="pos" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Punto de venta</p><h2>Cobra membresías, servicios y productos</h2></div><span>Precios y existencias validados por ACTIIVA</span></div>
            <div className="gym-commerce-grid">
              <GymPOSForm subdomain={siteSubdomain} branches={data.branches} customers={data.customers} catalog={data.catalog} cashOpenBranchIds={data.cashSessions.map((session) => session.branchId)} />
              <div className="gym-cash-stack">{data.branches.map((branch) => <GymCashForm key={branch.id} subdomain={siteSubdomain} branches={[branch]} session={data.cashSessions.find((session) => session.branchId === branch.id) ?? null} />)}</div>
            </div>
          </section>

          <section id="payments" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Cobros reales</p><h2>Movimientos de este mes</h2></div><span>{money(data.metrics.collectedThisMonthCents)} confirmado</span></div>
            <div className="gym-payments-table">
              <div className="gym-payment-row is-head"><span>Venta</span><span>Persona</span><span>Método</span><span>Fecha</span><span>Total</span></div>
              {data.payments.length ? data.payments.map((payment) => <div className="gym-payment-row" key={payment.id}><strong>#{payment.orderNumber}</strong><span>{payment.customerName ?? "Mostrador"}</span><span>{PAYMENT_LABELS[payment.method]}</span><span>{formatDateTime(payment.paidAt)}</span><div><strong>{money(payment.amountCents)}</strong>{payment.receiptToken ? <a href={`/recibos/${payment.receiptToken}`} target="_blank">Recibo ↗</a> : null}</div></div>) : <div className="gym-table-empty">Aún no hay cobros este mes. La primera venta aparecerá aquí, no como ingreso estimado.</div>}
            </div>
          </section>

          <section id="inventory" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Inventario</p><h2>Existencias en sucursal</h2></div><span>Descuento automático al vender</span></div>
            <div className="gym-inventory-layout"><div className="gym-inventory-list">{data.catalog.filter((item) => item.tracksInventory).map((item) => <article key={item.id} className={(item.inventoryQuantity ?? 0) <= (item.reorderPoint ?? 0) ? "is-low" : ""}><div><strong>{item.name}</strong><small>{item.sku}</small></div><span>{item.inventoryQuantity ?? 0}<small>unidades</small></span><em>Reordenar en {item.reorderPoint ?? 0}</em></article>)}</div><div className="gym-inventory-tools"><GymInventoryForm subdomain={siteSubdomain} branches={data.branches} items={data.catalog.filter((item) => item.tracksInventory)} /><GymCatalogItemForm subdomain={siteSubdomain} branches={data.branches} /></div></div>
          </section>

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
              {data.demands.length ? data.demands.map((demand) => <article key={demand.key} className={demand.ready ? "is-ready" : ""}><div><span>{DAY_LABELS[demand.weekday]} {TIME_LABELS[demand.timeWindow]}</span><h3>{demand.className}</h3></div><strong>{demand.requestCount}<small>/{demand.threshold}</small></strong><div className="gym-demand-track"><span style={{ width: `${Math.min((demand.requestCount / demand.threshold) * 100, 100)}%` }} /></div><p>{demand.ready ? "La señal está lista, pero requiere tu autorización." : `Faltan ${demand.threshold - demand.requestCount} personas para activar la señal.`}</p><small>{demand.requesterNames.join(" · ")}</small>{demand.ready ? <GymDemandApprovalForm subdomain={siteSubdomain} demand={demand} branches={data.branches} /> : null}</article>) : <div className="gym-empty-operation">Todavía no hay solicitudes ligadas a una lista de espera.</div>}
            </div>
          </section>

          <section id="members" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Socios</p><h2>Personas y membresías</h2></div><span>{data.customers.length} registros</span></div>
            <div className="gym-customer-table" role="table" aria-label="Socios del gimnasio">
              <div className="gym-table-head" role="row"><span>Persona</span><span>Plan</span><span>Estado</span><span>Acción</span></div>
              {data.customers.map((customer) => <div className="gym-table-row" role="row" key={customer.id}><div><strong>{customer.name}</strong><small>{customer.email}</small></div><span>{customer.membership ? <>{customer.membership.planName}<small>{customer.membership.daysRemaining} días · vence {formatDate(customer.membership.endsOn)}</small>{customer.upcomingMembership ? <small>Renovación pagada: {customer.upcomingMembership.startsOn}</small> : null}</> : customer.planName ?? "Sin plan"}</span><span className={`gym-customer-status is-${customer.status}`}>{STATUS_LABELS[customer.status]}</span><GymCustomerStatusForm subdomain={siteSubdomain} customerId={customer.id} status={customer.status} /></div>)}
            </div>
          </section>

          <section id="plans" className="gym-management-section"><div className="gym-management-section-head"><div><p className="gym-panel-label">Membresías configurables</p><h2>Precio, duración, créditos y tolerancia</h2></div><span>La autorrenovación queda apagada durante conciliación</span></div><div className="gym-plan-settings-list">{data.plans.map((plan) => <GymPlanSettingsForm key={plan.id} subdomain={siteSubdomain} plan={plan} />)}</div></section>

          <section id="settings" className="gym-management-section">
            <div className="gym-management-section-head"><div><p className="gym-panel-label">Configuración</p><h2>Reglas e integraciones del negocio</h2></div><span>Control del dueño</span></div>
            <div className="gym-settings-grid">
              <GymOperationsSettingsForm subdomain={siteSubdomain} threshold={data.site.scheduleInterestThreshold} holdHours={data.site.demandHoldHours} />
              <div className="gym-integrations-panel"><article><div><span>MP</span><strong>Mercado Pago</strong></div><em>{data.connections.find((item) => item.provider === "mercado_pago")?.status === "connected" ? "Conectado" : "Pendiente de conectar"}</em><p>Pagos online manuales primero; recurrencia después de probar conciliación.</p></article><article><div><span>WA</span><strong>WhatsApp Business</strong></div><em>{data.connections.find((item) => item.provider === "whatsapp")?.status === "connected" ? "Conectado" : "Pendiente de conectar"}</em><p>{data.metrics.whatsappDrafts ? `${data.metrics.whatsappDrafts} avisos están en borrador seguro.` : "Los avisos saldrán desde el número formal del negocio."}</p></article></div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
