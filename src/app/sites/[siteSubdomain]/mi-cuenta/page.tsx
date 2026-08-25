import { notFound } from "next/navigation";
import { getGymMemberData } from "@/features/gym-platform/server/data";
import { GymBookingForm } from "@/features/gym-platform/ui/GymBookingForm";
import { GymAppHeader } from "@/features/gym-platform/ui/GymChrome";
import { GymScheduleRequestForm } from "@/features/gym-platform/ui/GymScheduleRequestForm";
import { GymHoldConfirmForm } from "@/features/gym-platform/ui/GymHoldConfirmForm";
import { GymMemberProfileForm } from "@/features/gym-platform/ui/GymMemberProfileForm";

function formatDate(value: string | null, withWeekday = false): string {
  return value ? new Intl.DateTimeFormat("es-MX", withWeekday
    ? { weekday: "short", day: "numeric", month: "short" }
    : { day: "numeric", month: "long" })
    .format(new Date(`${value}T12:00:00`)) : "Por definir";
}

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function GymMemberPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const data = await getGymMemberData(siteSubdomain);
  if (!data) notFound();
  const firstName = data.member.name.split(" ")[0];
  const nextConfirmed = data.occurrences.find((occurrence) => occurrence.reservationStatus === "reserved");
  const waitlisted = data.occurrences.flatMap((occurrence) => occurrence.reservationStatus === "waitlisted" && occurrence.reservationId
    ? [{ reservationId: occurrence.reservationId, className: occurrence.name, classDate: occurrence.classDate }]
    : []);
  return (
    <div className="gym-member-app">
      <GymAppHeader area="member" email={data.member.email} />
      <main className="gym-member-main">
        <header className="gym-member-welcome">
          <div><p className="gym-kicker">Tu espacio ACTGym</p><h1>Hola, {firstName}.</h1><p>{nextConfirmed ? `Tu próxima sesión es ${nextConfirmed.name}, ${formatDate(nextConfirmed.classDate, true)} a las ${nextConfirmed.startTime}.` : "Arma tu semana reservando una sesión."}</p></div>
          <div className="gym-week-score"><strong>{data.reservationSummary.reserved}<span> + {data.reservationSummary.waitlisted}</span></strong><small>confirmadas + en espera</small></div>
        </header>

        <div className="gym-member-grid">
          <section className="gym-member-plan">
            <p className="gym-panel-label">Tu membresía</p><div className="gym-plan-badge"><span>ACT</span><strong>{data.member.planName ?? "Sin plan"}</strong></div>
            <dl><div><dt>Estado</dt><dd>{data.member.status === "active" ? "Activa" : data.member.status === "paused" ? "En pausa" : "Sin acceso"}</dd></div><div><dt>Vigencia</dt><dd>{data.member.membership ? `${data.member.membership.daysRemaining} días` : "Por definir"}</dd></div><div><dt>Termina</dt><dd>{formatDate(data.member.membership?.endsOn ?? null)}</dd></div><div><dt>Clases</dt><dd>{data.member.membership?.creditsRemaining === null ? "Ilimitadas" : `${data.member.membership?.creditsRemaining ?? 0} créditos`}</dd></div></dl>
            <div className="gym-renewal-state">{data.member.upcomingMembership ? <><strong>Renovación pagada</strong><span>Inicia {formatDate(data.member.upcomingMembership.startsOn)}</span></> : <><strong>{money(data.member.planPriceCents)}</strong><span>Renueva en recepción o desde aquí cuando el gimnasio conecte Mercado Pago.</span></>}</div>
          </section>
          <section className="gym-next-session-panel">
            <p className="gym-panel-label">Tu siguiente movimiento</p>
            {nextConfirmed ? <><time>{nextConfirmed.startTime}</time><h2>{nextConfirmed.name}</h2><p>{formatDate(nextConfirmed.classDate, true)} · Coach {nextConfirmed.coach}</p><span>Tu lugar está confirmado</span></> : <><strong>Agenda abierta</strong><h2>Elige una clase</h2><p>Reserva abajo; si el cupo se llena, conservas tu turno en lista de espera.</p></>}
          </section>
        </div>

        {data.holds.length ? <section className="gym-member-holds">
          <div className="gym-member-section-head"><div><p className="gym-panel-label">Sesiones adicionales</p><h2>Tus apartados</h2></div><span>Confirma antes de que termine la vigencia</span></div>
          <div>{data.holds.map((hold) => <article key={hold.id} className={`is-${hold.status}`}><div><span>{hold.status === "confirmed" ? "Lugar confirmado" : "Apartado temporal"}</span><h3>{hold.className}</h3><p>{formatDateTime(hold.startsAt)}</p><small>{hold.status === "pending" ? `Vence ${formatDateTime(hold.expiresAt)}` : "Ya avisamos al gimnasio"}</small></div><strong>{hold.priceCents ? money(hold.priceCents) : "Incluida"}</strong>{hold.priceCents > 0 ? <p className="gym-hold-payment-note">El enlace de Mercado Pago se habilitará al conectar la cuenta del negocio.</p> : <GymHoldConfirmForm subdomain={siteSubdomain} token={hold.token} disabled={hold.status === "confirmed"} />}</article>)}</div>
        </section> : null}

        <section className="gym-member-classes">
          <div className="gym-member-section-head"><div><p className="gym-panel-label">Agenda</p><h2>Reserva los próximos días</h2></div><span>Cupo y lista de espera en tiempo real</span></div>
          <div className="gym-member-class-grid">
            {data.occurrences.map((occurrence) => (
              <article key={occurrence.key} className={occurrence.reservationStatus ? `has-${occurrence.reservationStatus}` : ""}>
                <div className="gym-class-card-top"><time>{occurrence.startTime}</time><span>{formatDate(occurrence.classDate, true)}</span></div>
                <h3>{occurrence.name}</h3><p>Coach {occurrence.coach} · {occurrence.durationMinutes} min</p>
                <div className="gym-class-capacity"><span>{occurrence.availableSpots > 0 ? `${occurrence.availableSpots} lugares libres` : "Cupo completo"}</span>{occurrence.waitlistCount > 0 ? <small>{occurrence.waitlistCount} en espera</small> : null}</div>
                {occurrence.reservationStatus ? <div className={`gym-booking-state is-${occurrence.reservationStatus}`}>{occurrence.reservationStatus === "reserved" ? "Lugar confirmado" : "En lista de espera"}</div> : null}
                {data.member.status === "active" ? <GymBookingForm subdomain={siteSubdomain} classId={occurrence.classId} classDate={occurrence.classDate} reservationId={occurrence.reservationId} reservationStatus={occurrence.reservationStatus} availableSpots={occurrence.availableSpots} /> : <p className="gym-membership-blocked">Reactiva tu membresía para reservar.</p>}
              </article>
            ))}
          </div>
        </section>

        {waitlisted.length ? <section className="gym-demand-panel">
          <div><p className="gym-panel-label">La clase estaba llena</p><h2>Propón un horario alterno</h2><p>Como ya estás en lista de espera, puedes señalar otro horario. Al reunir {data.site.scheduleInterestThreshold} personas, ACTGym podrá autorizar una sesión adicional y apartarte un lugar durante {data.site.demandHoldHours} horas.</p></div>
          <GymScheduleRequestForm subdomain={siteSubdomain} waitlisted={waitlisted} />
        </section> : null}

        <section className="gym-member-payments">
          <div className="gym-member-section-head"><div><p className="gym-panel-label">Pagos y comprobantes</p><h2>Tu historial</h2></div><span>Sólo movimientos confirmados</span></div>
          <div className="gym-member-payment-list">{data.payments.length ? data.payments.map((payment) => <article key={payment.id}><div><strong>Venta #{payment.orderNumber}</strong><span>{new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date(payment.paidAt))}</span></div><strong>{money(payment.amountCents)}</strong>{payment.receiptToken ? <a href={`/recibos/${payment.receiptToken}`} target="_blank">Recibo digital ↗</a> : null}</article>) : <div className="gym-member-empty">Todavía no tienes pagos digitales registrados.</div>}</div>
        </section>

        <section className="gym-member-profile"><GymMemberProfileForm subdomain={siteSubdomain} name={data.member.name} phone={data.member.phone} email={data.member.email} /></section>
      </main>
    </div>
  );
}
