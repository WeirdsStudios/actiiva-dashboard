import { notFound } from "next/navigation";
import { getGymMemberData } from "@/features/gym-platform/server/data";
import { GymBookingForm } from "@/features/gym-platform/ui/GymBookingForm";
import { GymAppHeader } from "@/features/gym-platform/ui/GymChrome";
import { GymScheduleRequestForm } from "@/features/gym-platform/ui/GymScheduleRequestForm";

function formatDate(value: string | null, withWeekday = false): string {
  return value ? new Intl.DateTimeFormat("es-MX", withWeekday
    ? { weekday: "short", day: "numeric", month: "short" }
    : { day: "numeric", month: "long" })
    .format(new Date(`${value}T12:00:00`)) : "Por definir";
}

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function GymMemberPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const data = await getGymMemberData(siteSubdomain);
  if (!data) notFound();
  const firstName = data.member.name.split(" ")[0];
  const nextConfirmed = data.occurrences.find((occurrence) => occurrence.reservationStatus === "reserved");
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
            <dl><div><dt>Estado</dt><dd>{data.member.status === "active" ? "Activa" : data.member.status === "paused" ? "En pausa" : "Sin acceso"}</dd></div><div><dt>Próximo pago</dt><dd>{formatDate(data.member.nextPaymentOn)}</dd></div><div><dt>Mensualidad</dt><dd>{money(data.member.planPriceCents)}</dd></div></dl>
          </section>
          <section className="gym-next-session-panel">
            <p className="gym-panel-label">Tu siguiente movimiento</p>
            {nextConfirmed ? <><time>{nextConfirmed.startTime}</time><h2>{nextConfirmed.name}</h2><p>{formatDate(nextConfirmed.classDate, true)} · Coach {nextConfirmed.coach}</p><span>Tu lugar está confirmado</span></> : <><strong>Agenda abierta</strong><h2>Elige una clase</h2><p>Reserva abajo; si el cupo se llena, conservas tu turno en lista de espera.</p></>}
          </section>
        </div>

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

        <section className="gym-demand-panel">
          <div><p className="gym-panel-label">Agenda que escucha</p><h2>¿Ningún horario te funciona?</h2><p>Pide otro horario. Al reunir {data.site.scheduleInterestThreshold} personas con la misma preferencia, ACTGym recibe una señal para abrirlo.</p></div>
          <GymScheduleRequestForm subdomain={siteSubdomain} classes={data.classes} />
        </section>
      </main>
    </div>
  );
}
