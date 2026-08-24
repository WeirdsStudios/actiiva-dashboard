// Reemplaza el texto plano "Escribiendo..." — una señal visual sutil de que
// hay algo inteligente procesando, no decoración de fondo. Los 3 puntos usan
// Lumen Haze solo en su pico de opacidad (ver .actiiva-pulse-dot en
// globals.css) — nunca como superficie, cumpliendo la regla del brand system
// de 1-3% de pantalla como señal puntual.
import Image from "next/image";

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 self-start">
      <Image src="/brand/actiiva-app-icon-light.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-[8px]" />
      <div className="flex items-center gap-1 rounded-lg bg-surface px-3 py-2.5">
        <span className="actiiva-pulse-dot h-1.5 w-1.5 rounded-full" style={{ animationDelay: "0ms" }} />
        <span className="actiiva-pulse-dot h-1.5 w-1.5 rounded-full" style={{ animationDelay: "160ms" }} />
        <span className="actiiva-pulse-dot h-1.5 w-1.5 rounded-full" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}
