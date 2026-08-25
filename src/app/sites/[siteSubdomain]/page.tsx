import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGymPlatform } from "@/features/gym-platform/server/data";
import { GymPublicHeader, GymWordmark } from "@/features/gym-platform/ui/GymChrome";

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);
}

function occurrenceDate(value: string, compact = false): string {
  return new Intl.DateTimeFormat("es-MX", compact
    ? { weekday: "short", day: "numeric" }
    : { weekday: "long", day: "numeric", month: "short" })
    .format(new Date(`${value}T12:00:00`));
}

function planPeriod(plan: { durationCount: number; durationUnit: "day" | "week" | "month" | "year" }): string {
  const units = { day: ["día", "días"], week: ["semana", "semanas"], month: ["mes", "meses"], year: ["año", "años"] } as const;
  return plan.durationCount === 1 ? `/ ${units[plan.durationUnit][0]}` : `/ ${plan.durationCount} ${units[plan.durationUnit][1]}`;
}

export async function generateMetadata({ params }: { params: Promise<{ siteSubdomain: string }> }): Promise<Metadata> {
  const { siteSubdomain } = await params;
  const platform = await getPublicGymPlatform(siteSubdomain);
  if (!platform) return {};
  const title = `${platform.site.name} — Entrena con intención`;
  const canonicalUrl = `https://${platform.site.subdomain}.actiiva.mx`;
  return {
    metadataBase: new URL(canonicalUrl),
    title,
    description: platform.site.description,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description: platform.site.description,
      url: "/",
      siteName: platform.site.name,
      locale: "es_MX",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: platform.site.description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function GymPublicPage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const platform = await getPublicGymPlatform(siteSubdomain);
  if (!platform) notFound();
  const { site, plans, occurrences } = platform;
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
          <div className="gym-rail-head"><span>Próximas sesiones</span><strong>Cupo en vivo</strong></div>
          {occurrences.slice(0, 4).map((occurrence, index) => (
            <div key={occurrence.key} className="gym-rail-row">
              <span className="gym-rail-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{occurrence.name}</strong>
              <span>{occurrence.startTime}</span>
              <small>{occurrenceDate(occurrence.classDate, true)} · {occurrence.availableSpots > 0 ? `${occurrence.availableSpots} lugares` : "Lista de espera"}</small>
            </div>
          ))}
          <div className="gym-rail-marker"><span>Reserva desde tu cuenta ACTGym</span></div>
        </aside>
      </section>

      <section id="metodo" className="gym-manifesto">
        <div><p className="gym-kicker">El método ACT</p><h2>Medir.<br />Entrenar.<br /><span>Ajustar.</span></h2></div>
        <div className="gym-manifesto-copy"><p>{site.tagline}</p><p>No acumulamos rutinas. Cada bloque tiene una intención, cada sesión deja una señal y cada mes ajusta el camino.</p><dl><div><dt>55 min</dt><dd>Sesiones concretas</dd></div><div><dt>12</dt><dd>Personas por coach</dd></div><div><dt>1× mes</dt><dd>Revisión de progreso</dd></div></dl></div>
      </section>

      <section id="horarios" className="gym-schedule-section">
        <div className="gym-section-heading"><p className="gym-kicker">Agenda en vivo</p><h2>Elige tu ritmo.</h2><p>Consulta las próximas sesiones y su disponibilidad. Los socios reservan desde su portal.</p><Link href="/mi-cuenta" className="gym-schedule-cta">Abrir mi agenda →</Link></div>
        <div className="gym-schedule-list">
          {occurrences.slice(0, 8).map((occurrence) => (
            <article key={occurrence.key}>
              <div className="gym-class-time"><strong>{occurrence.startTime}</strong><span>{occurrence.durationMinutes} min</span></div>
              <div><h3>{occurrence.name}</h3><p>{occurrenceDate(occurrence.classDate)} · Coach {occurrence.coach}</p></div>
              <span className={`gym-availability ${occurrence.availableSpots === 0 ? "is-full" : ""}`}>{occurrence.availableSpots > 0 ? `${occurrence.availableSpots} libres` : "Espera"}</span>
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
              <div className="gym-price"><strong>{money(plan.priceCents)}</strong><span>{planPeriod(plan)}</span></div>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <p className="gym-plan-access">{plan.classAccess === "unlimited" ? "Clases ilimitadas" : plan.classAccess === "credits" ? `${plan.classCredits} clases por periodo` : "Acceso sin clases"} · {plan.graceDays ? `${plan.graceDays} días de tolerancia` : "Sin días de tolerancia"}</p>
              <Link href="/mi-cuenta">Acceder como socio →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="gym-contact-strip"><div><p className="gym-kicker">¿Primera vez?</p><h2>Conoce el espacio antes de elegir.</h2></div><div><span>Agenda una visita con el equipo</span><a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone} →</a></div></section>

      <footer className="gym-footer"><GymWordmark /><div><strong>{site.address}</strong><span>{site.phone}</span></div><nav><Link href="/mi-cuenta">Portal de socios</Link><Link href="/gestion">Gestión</Link></nav><small>Negocio de demostración creado con ACTIIVA.</small></footer>
    </main>
  );
}
