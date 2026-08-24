import Image from "next/image";
import { PortalSetupForm } from "@/features/portal/ui/PortalSetupForm";

export default function PortalSetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-9">
        <Image src="/brand/actiiva-wordmark-primary.svg" alt="ACTIIVA" width={142} height={34} className="h-8 w-auto" />
        <p className="mt-10 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Activar portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">Crea tu acceso</h1>
        <p className="mt-3 mb-8 text-sm leading-6 text-secondary">Esta contraseña será personal. No la compartas con otras personas de tu equipo.</p>
        <PortalSetupForm />
      </section>
    </main>
  );
}
