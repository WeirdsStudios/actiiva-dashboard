import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrganization } from "@/features/organizations/server/data";
import { InviteMemberForm, MemberAccessList, type MemberAccessItem } from "@/features/organizations/ui/MemberAccessPanel";

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  archived: "Archivado",
};

const DISCOVERY_STATUS_LABELS: Record<string, string> = {
  in_progress: "En conversación",
  submitted: "En revisión",
  approved: "Aprobado",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminClientDetailPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const result = await getAdminOrganization(organizationId);
  if (!result) notFound();
  const { organization, sessions, members } = result;
  const primarySession = sessions[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/admin/clients" className="text-sm font-medium text-secondary hover:text-foreground">← Volver a clientes</Link>

      <header className="mt-6 border-b border-border pb-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-success-surface px-3 py-1 text-xs font-medium text-success">{STATUS_LABELS[organization.status] ?? organization.status}</span>
              <span className="font-mono text-xs text-muted">{organization.slug}</span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">{organization.name}</h1>
            <p className="mt-2 text-sm text-muted">Cliente ACTIIVA desde el {formatDate(organization.created_at)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label="Recorrido de activación">
            {[
              ["Onboarding", primarySession?.created_at ?? null],
              ["Aprobación", primarySession?.approved_at ?? null],
              ["Cliente", organization.created_at],
            ].map(([label, date]) => (
              <div key={label} className="min-w-24 border-t-2 border-primary pt-2">
                <span className="block text-xs font-semibold text-foreground">{label}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{formatDate(date)}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="flex items-end justify-between border-b border-border pb-3">
            <div><p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Origen de la cuenta</p><h2 className="mt-1 text-2xl font-semibold text-foreground">Onboardings vinculados</h2></div>
            <span className="text-sm text-muted">{sessions.length}</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {sessions.map((session) => (
              <Link key={session.id} href={`/admin/discovery/${session.id}`} className="group grid gap-3 border-b border-border px-5 py-5 last:border-0 hover:bg-canvas sm:grid-cols-[minmax(0,1fr)_140px_170px_28px] sm:items-center">
                <div><p className="font-semibold text-foreground">{session.business_name_draft || organization.name}</p><p className="mt-1 text-xs text-muted">Pack {session.pack_version}</p></div>
                <span className="w-fit rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-secondary">{DISCOVERY_STATUS_LABELS[session.status] ?? session.status}</span>
                <p className="text-sm text-muted">{formatDate(session.updated_at)}</p>
                <span className="hidden text-xl text-muted transition-transform group-hover:translate-x-1 sm:block">→</span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Acceso del cliente</p>
            <div className="mt-4 flex items-baseline justify-between border-b border-border pb-4">
              <strong className="text-3xl text-foreground">{members.length}</strong>
              <span className="text-xs text-muted">miembros asignados</span>
            </div>
            {members.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-secondary">La cuenta está aislada y lista para su primer propietario.</p>
            ) : (
              <MemberAccessList organizationId={organization.id} members={members as MemberAccessItem[]} />
            )}
            <InviteMemberForm organizationId={organization.id} />
          </section>
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Frontera de datos</p>
            <p className="mt-3 text-sm leading-6 text-secondary">Esta cuenta tiene un identificador propio. Ningún futuro miembro podrá consultar información de otro cliente.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
