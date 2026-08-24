import Link from "next/link";
import { logoutGymPlatform } from "../server/actions";

export function GymWordmark({ compact = false }: { compact?: boolean }) {
  return <span className={`gym-wordmark ${compact ? "is-compact" : ""}`}><span>ACT</span><i>／</i><span>GYM</span></span>;
}

export function GymPublicHeader() {
  return (
    <header className="gym-public-header">
      <Link href="/" aria-label="ACTGym, inicio"><GymWordmark /></Link>
      <nav aria-label="Principal">
        <a href="#metodo">Método</a>
        <a href="#horarios">Horarios</a>
        <a href="#planes">Planes</a>
      </nav>
      <Link href="/mi-cuenta" className="gym-outline-button">Soy socio</Link>
    </header>
  );
}

export function GymAppHeader({ area, email }: { area: "member" | "manager"; email: string }) {
  return (
    <header className="gym-app-header">
      <Link href="/"><GymWordmark compact /></Link>
      <div className="gym-app-area"><span>{area === "manager" ? "Gestión" : "Mi cuenta"}</span><small>{email}</small></div>
      <form action={logoutGymPlatform}><button type="submit">Salir</button></form>
    </header>
  );
}
