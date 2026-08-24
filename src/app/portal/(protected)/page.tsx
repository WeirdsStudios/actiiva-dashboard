import Link from "next/link";
import { redirect } from "next/navigation";
import { listPortalOrganizations } from "@/features/portal/server/data";

const ROLE_LABELS = { owner: "Propietario", admin: "Administrador", member: "Miembro" } as const;

export default async function PortalHomePage() {
  const organizations = await listPortalOrganizations();
  if (organizations.length === 1) redirect(`/portal/${organizations[0].slug}`);
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Tus cuentas</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">Elige un negocio</h1>
      {organizations.length === 0 ? (
        <div className="mt-8 max-w-xl rounded-xl border border-border bg-surface p-6"><h2 className="text-xl font-semibold text-foreground">Sin accesos activos</h2><p className="mt-2 text-sm leading-6 text-secondary">Tu sesión es válida, pero todavía no tienes una cuenta activa. Contacta a ACTIIVA.</p></div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {organizations.map((organization) => (
            <Link key={organization.id} href={`/portal/${organization.slug}`} className="group rounded-xl border border-border bg-surface p-6 shadow-sm hover:border-secondary">
              <span className="text-xs font-medium text-muted">{ROLE_LABELS[organization.role]}</span>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">{organization.name}</h2>
              <span className="mt-6 block text-sm font-semibold text-secondary group-hover:text-foreground">Abrir cuenta →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
