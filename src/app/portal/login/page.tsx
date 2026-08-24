import Image from "next/image";
import { redirect } from "next/navigation";
import { getPortalIdentity } from "@/features/portal/server/data";
import { PortalLoginForm } from "@/features/portal/ui/PortalLoginForm";

export default async function PortalLoginPage() {
  if (await getPortalIdentity()) redirect("/portal");
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(420px,0.72fr)_minmax(0,1fr)]">
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Image src="/brand/actiiva-wordmark-primary.svg" alt="ACTIIVA" width={142} height={34} className="mb-12 h-8 w-auto" />
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Portal del cliente</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">Tu negocio, en marcha</h1>
          <p className="mt-3 mb-8 text-sm leading-6 text-secondary">Consulta el estado de tu cuenta y los próximos pasos de activación.</p>
          <PortalLoginForm />
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-sm tracking-[0.16em] text-white/60 uppercase">ACTIIVA contigo</p>
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-semibold text-signal">01 — Información lista</p>
          <h2 className="mt-5 text-5xl leading-[1.02] font-semibold tracking-[-0.04em]">Del plan a una operación que avanza.</h2>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/70">Un solo lugar para saber qué está listo, qué sigue y quién tiene acceso.</p>
        </div>
        <div aria-hidden className="absolute -right-16 top-1/2 h-px w-2/3 -rotate-12 bg-white/15" />
        <p className="text-xs tracking-[0.12em] text-white/45 uppercase">Portal seguro para tu equipo</p>
      </section>
    </main>
  );
}
