import Link from "next/link";
import { GymLoginForm } from "./GymLoginForm";
import { GymWordmark } from "./GymChrome";

export function GymAccessScreen({ subdomain, mode, accessError = false }: { subdomain: string; mode: "member" | "manager"; accessError?: boolean }) {
  const manager = mode === "manager";
  return (
    <main className="gym-access-page">
      <section className="gym-access-visual" aria-hidden>
        <GymWordmark />
        <div className="gym-access-count">{manager ? "03" : "02"}</div>
        <p>{manager ? "Decide con el negocio a la vista." : "Tu entrenamiento sigue fuera del gimnasio."}</p>
        <div className="gym-lane-lines" />
      </section>
      <section className="gym-access-form-wrap">
        <Link href="/" className="gym-back-link">← Volver a ACTGym</Link>
        <p className="gym-kicker">{manager ? "Panel de gestión" : "Portal del socio"}</p>
        <h1>{manager ? "Opera el día." : "Continúa tu progreso."}</h1>
        <p className="gym-access-copy">{manager ? "Consulta socios, ingresos y agenda con tu acceso de operador." : "Revisa tu plan, próximo pago y clases disponibles."}</p>
        {accessError ? <p className="gym-form-error">La cuenta inició sesión, pero no tiene acceso a esta sección.</p> : null}
        <GymLoginForm subdomain={subdomain} mode={mode} />
        <p className="gym-demo-note">Para esta prueba usa tu acceso ACTIIVA actual.</p>
      </section>
    </main>
  );
}
