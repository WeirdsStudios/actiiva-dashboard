import Link from "next/link";
import { listAdminOrganizations } from "@/features/organizations/server/data";

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  archived: "Archivado",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminClientsPage() {
  const organizations = await listAdminOrganizations();
  const activeCount = organizations.filter((organization) => organization.status === "active").length;
  const withMembers = organizations.filter((organization) => organization.memberCount > 0).length;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Cartera ACTIIVA</p>
        <div className="mt-2 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
              Cada cliente, aislado y listo para crecer.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-secondary">
              Aquí aparecen los onboardings que aprobaste y convertiste en cuentas operativas.
            </p>
          </div>
          <div className="flex gap-8 border-l-2 border-signal pl-5">
            <div><strong className="block text-2xl text-foreground">{activeCount}</strong><span className="text-xs text-muted">clientes activos</span></div>
            <div><strong className="block text-2xl text-foreground">{withMembers}</strong><span className="text-xs text-muted">con acceso asignado</span></div>
          </div>
        </div>
      </header>

      {organizations.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-surface p-10 sm:p-14">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Primer cliente</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">La cartera empieza con una aprobación.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-secondary">
            Cuando un negocio termine su onboarding, aprueba su información y elige “Crear cliente ACTIIVA”. Su cuenta aparecerá aquí sin alterar las sesiones que siguen en conversación.
          </p>
          <Link href="/admin/discovery?status=submitted" className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white">
            Ver sesiones en revisión
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="hidden grid-cols-[minmax(260px,1.5fr)_120px_130px_160px_32px] gap-4 border-b border-border px-5 py-3 text-xs font-semibold tracking-[0.08em] text-muted uppercase md:grid">
            <span>Cliente</span><span>Estado</span><span>Accesos</span><span>Activado</span><span />
          </div>
          {organizations.map((organization) => (
            <Link
              key={organization.id}
              href={`/admin/clients/${organization.id}`}
              className="group grid gap-4 border-b border-border border-l-4 border-l-primary px-5 py-5 last:border-b-0 hover:bg-canvas md:grid-cols-[minmax(260px,1.5fr)_120px_130px_160px_32px] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{organization.name}</p>
                <p className="mt-1 truncate font-mono text-xs text-muted">{organization.slug}</p>
              </div>
              <span className="w-fit rounded-full bg-success-surface px-2.5 py-1 text-xs font-medium text-success">{STATUS_LABELS[organization.status] ?? organization.status}</span>
              <p className="text-sm text-secondary">{organization.memberCount} {organization.memberCount === 1 ? "miembro" : "miembros"}</p>
              <p className="text-sm text-muted">{formatDate(organization.createdAt)}</p>
              <span className="hidden text-xl text-muted transition-transform group-hover:translate-x-1 md:block">→</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
