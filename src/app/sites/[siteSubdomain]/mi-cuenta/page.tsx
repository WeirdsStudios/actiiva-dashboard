import { notFound } from "next/navigation";
import { getGymMemberData } from "@/features/gym-platform/server/data";
import { GymAppHeader } from "@/features/gym-platform/ui/GymChrome";

const DAY_LABELS: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`)) : "Por definir";
}

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function GymMemberPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const data = await getGymMemberData(siteSubdomain);
  if (!data) notFound();
  const firstName = data.member.name.split(" ")[0];
  return (
    <div className="gym-member-app">
      <GymAppHeader area="member" email={data.member.email} />
      <main className="gym-member-main">
        <header className="gym-member-welcome"><div><p className="gym-kicker">Semana 16 · bloque de fuerza</p><h1>Hola, {firstName}.</h1><p>Tu plan sigue activo. Esta semana el objetivo es completar tres sesiones.</p></div><div className="gym-week-score"><strong>2<span>/3</span></strong><small>sesiones esta semana</small></div></header>
        <div className="gym-member-grid">
          <section className="gym-member-plan">
            <p className="gym-panel-label">Tu membresía</p><div className="gym-plan-badge"><span>ACT</span><strong>{data.member.planName ?? "Sin plan"}</strong></div>
            <dl><div><dt>Estado</dt><dd>{data.member.status === "active" ? "Activa" : "En pausa"}</dd></div><div><dt>Próximo pago</dt><dd>{formatDate(data.member.nextPaymentOn)}</dd></div><div><dt>Mensualidad</dt><dd>{money(data.member.planPriceCents)}</dd></div></dl>
          </section>
          <section className="gym-progress-panel"><p className="gym-panel-label">Tu señal de progreso</p><div className="gym-progress-ring"><strong>68</strong><span>consistencia</span></div><p>Vas 9 puntos arriba del mes anterior. Una sesión más mantiene tu ritmo.</p></section>
        </div>
        <section className="gym-member-classes">
          <div className="gym-member-section-head"><div><p className="gym-panel-label">Próximas clases</p><h2>Tu semana disponible</h2></div><span>Reserva interactiva · siguiente slice</span></div>
          <div className="gym-member-class-grid">{data.classes.map((gymClass) => <article key={gymClass.id}><time>{gymClass.startTime}</time><h3>{gymClass.name}</h3><p>{gymClass.weekdays.map((day) => DAY_LABELS[day]).join(" · ")}</p><span>Coach {gymClass.coach}</span><button type="button" disabled>Reservar pronto</button></article>)}</div>
        </section>
      </main>
    </div>
  );
}
