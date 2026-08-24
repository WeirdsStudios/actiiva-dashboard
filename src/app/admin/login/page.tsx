import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/admin-auth";
import { LoginForm } from "@/features/discovery-admin/ui/LoginForm";

export default async function AdminLoginPage() {
  if (await getAdminIdentity()) redirect("/admin/discovery");

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Image src="/brand/actiiva-app-icon-light.svg" alt="ACTIIVA" width={44} height={44} className="h-11 w-11 self-start rounded-xl" />
        <div className="relative z-10 max-w-xl">
          <p className="text-sm tracking-[0.16em] text-white/60 uppercase">Centro de operaciones</p>
          <h1 className="mt-5 text-5xl leading-[1.02] font-semibold tracking-[-0.04em]">
            Cada negocio, desde su primera conversación.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
            Crea sesiones, sigue el avance y convierte la información confirmada en una implementación lista para operar.
          </p>
        </div>
        <div aria-hidden className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full border-[72px] border-white/[0.04]" />
        <p className="text-xs tracking-[0.12em] text-white/45 uppercase">Acceso exclusivo del equipo ACTIIVA</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Image src="/brand/actiiva-wordmark-primary.svg" alt="ACTIIVA" width={142} height={34} className="mb-12 h-8 w-auto lg:hidden" />
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Panel interno</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">Bienvenido de vuelta</h2>
          <p className="mt-3 mb-8 text-sm leading-6 text-secondary">Usa la cuenta que fue autorizada para administrar el onboarding.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
