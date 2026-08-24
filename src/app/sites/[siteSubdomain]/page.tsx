import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGymPlatform } from "@/features/gym-platform/server/data";
import { GymPublicHeader, GymWordmark } from "@/features/gym-platform/ui/GymChrome";

const DAY_LABELS: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

export async function generateMetadata({ params }: { params: Promise<{ siteSubdomain: string }> }): Promise<Metadata> {
  const { siteSubdomain } = await params;
  const platform = await getPublicGymPlatform(siteSubdomain);
  return platform ? { title: `${platform.site.name} — Entrena con intención`, description: platform.site.description } : {};
}

export default async function GymPublicPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const platform = await getPublicGymPlatform(siteSubdomain);
  if (!platform) notFound();
  const { site, plans, classes } = platform;
  return (
    <main className="gym-public-page" style={{ "--gym-ink": site.primaryColor, "--gym-accent": site.accentColor } as React.CSSProperties}>
      <GymPublicHeader />
      <section className="gym-hero">
        <div className="gym-hero-copy">
          <p className="gym-kicker">Fuerza · condición · movilidad</p>
          <h1>No vengas a cansarte.<br /><em>Ven a avanzar.</em></h1>
          <p>{site.description}</p>
          <div className="gym-hero-actions"><a href="#planes" className="gym-solid-button">Elegir mi plan</a><a href="#horarios" className="gym-text-link">Ver la semana →</a></div>
        </div>
        <aside className="gym-training-rail" aria-label="Agenda destacada">
          <div className="gym-rail-head"><span>Hoy en el carril</span><strong>{classes.length} formatos</strong></div>
          {classes.slice(0, 4).map((gymClass, index) => (
            <div key={gymClass.id} className="gym-rail-row">
              <span className="gym-rail-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{gymClass.name}</strong>
              <span>{gymClass.startTime}</span>
              <small>con {gymClass.coach}</small>
            </div>
          ))}
          <div className="gym-rail-marker"><span>Tu siguiente sesión empieza aquí</span></div>
        </aside>
      </section>

      <section id="metodo" className="gym-manifesto">
        <div><p className="gym-kicker">El método ACT</p><h2>Medir.<br />Entrenar.<br /><span>Ajustar.</span></h2></div>
        <div className="gym-manifesto-copy"><p>{site.tagline}</p><p>No acumulamos rutinas. Cada bloque tiene una intención, cada sesión deja una señal y cada mes ajusta el camino.</p><dl><div><dt>55 min</dt><dd>Sesiones concretas</dd></div><div><dt>12</dt><dd>Personas por coach</dd></div><div><dt>1× mes</dt><dd>Revisión de progreso</dd></div></dl></div>
      </section>

      <section id="horarios" className="gym-schedule-section">
        <div className="gym-section-heading"><p className="gym-kicker">La semana</p><h2>Elige tu ritmo.</h2><p>Cuatro formatos, mañana y tarde. La constancia cabe en tu agenda.</p></div>
        <div className="gym-schedule-list">
          {classes.map((gymClass) => (
            <article key={gymClass.id}>
              <div className="gym-class-time"><strong>{gymClass.startTime}</strong><span>{gymClass.durationMinutes} min</span></div>
              <div><h3>{gymClass.name}</h3><p>{gymClass.weekdays.map((day) => DAY_LABELS[day]).join(" · ")} · Coach {gymClass.coach}</p></div>
              <span className={`gym-intensity is-${gymClass.intensity}`}>{gymClass.intensity === "high" ? "Alta" : gymClass.intensity === "medium" ? "Media" : "Base"}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="planes" className="gym-plans-section">
        <div className="gym-section-heading is-light"><p className="gym-kicker">Membresías</p><h2>Un plan para sostener.</h2></div>
        <div className="gym-plan-grid">
          {plans.map((plan, index) => (
            <article key={plan.id} className={index === 1 ? "is-featured" : ""}>
              <span className="gym-plan-number">0{index + 1}</span><h3>{plan.name}</h3><p>{plan.description}</p>
              <div className="gym-price"><strong>{money(plan.priceCents)}</strong><span>/ mes</span></div>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <Link href="/mi-cuenta">Probar como socio →</Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="gym-footer"><GymWordmark /><div><strong>{site.address}</strong><span>{site.phone}</span></div><nav><Link href="/mi-cuenta">Portal de socios</Link><Link href="/gestion">Gestión</Link></nav><small>Negocio de demostración creado con ACTIIVA.</small></footer>
    </main>
  );
}
