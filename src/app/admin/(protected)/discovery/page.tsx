import Link from "next/link";
import { CreateSessionForm } from "@/features/discovery-admin/ui/CreateSessionForm";
import { listAdminDiscoverySessions } from "@/features/discovery-admin/server/data";

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "in_progress", label: "En conversación" },
  { value: "submitted", label: "En revisión" },
  { value: "approved", label: "Aprobadas" },
  { value: "reopen", label: "Reapertura solicitada" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  in_progress: "En conversación",
  submitted: "En revisión",
  approved: "Aprobada",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status = "all" }, sessions] = await Promise.all([searchParams, listAdminDiscoverySessions()]);
  const filtered = sessions.filter((session) => {
    if (status === "all") return true;
    if (status === "reopen") return Boolean(session.reopenRequestedAt);
    return session.status === status;
  });
  const waitingReopen = sessions.filter((session) => session.reopenRequestedAt).length;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] lg:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Onboarding activo</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            De la primera plática a un negocio listo para operar.
          </h1>
          <div className="mt-7 flex flex-wrap gap-7 border-l-2 border-signal pl-5">
            <div><strong className="block text-2xl text-foreground">{sessions.length}</strong><span className="text-xs text-muted">sesiones totales</span></div>
            <div><strong className="block text-2xl text-foreground">{sessions.filter((s) => s.status === "in_progress").length}</strong><span className="text-xs text-muted">en conversación</span></div>
            <div><strong className="block text-2xl text-foreground">{waitingReopen}</strong><span className="text-xs text-muted">requieren atención</span></div>
          </div>
        </div>
        <CreateSessionForm />
      </section>

      <section>
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Bandeja de trabajo</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">Sesiones</h2>
          </div>
          <nav className="flex gap-1 overflow-x-auto" aria-label="Filtrar sesiones">
            {FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={filter.value === "all" ? "/admin/discovery" : `/admin/discovery?status=${filter.value}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${status === filter.value ? "bg-primary text-white" : "text-secondary hover:bg-surface-subtle"}`}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="font-medium text-foreground">No hay sesiones en esta vista.</p>
            <p className="mt-1 text-sm text-muted">Crea una nueva o cambia el filtro.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="hidden grid-cols-[minmax(240px,1.4fr)_130px_150px_170px_36px] gap-4 border-b border-border px-5 py-3 text-xs font-semibold tracking-[0.08em] text-muted uppercase md:grid">
              <span>Negocio / avance</span><span>Estado</span><span>Conversación</span><span>Último cambio</span><span />
            </div>
            {filtered.map((session) => {
              const progress = Math.round((session.answeredCount / session.totalQuestions) * 100);
              return (
                <Link
                  key={session.id}
                  href={`/admin/discovery/${session.id}`}
                  className="group grid gap-4 border-b border-border px-5 py-5 last:border-0 hover:bg-canvas md:grid-cols-[minmax(240px,1.4fr)_130px_150px_170px_36px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-foreground">{session.businessName || "Negocio sin nombre"}</p>
                      <span className="text-xs text-muted md:hidden">{STATUS_LABELS[session.status] ?? session.status}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{session.answeredCount}/{session.totalQuestions}</span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${session.reopenRequestedAt ? "bg-warning-surface text-warning" : session.status === "approved" ? "bg-success-surface text-success" : "bg-surface-subtle text-secondary"}`}>
                      {session.reopenRequestedAt ? "Pide reapertura" : STATUS_LABELS[session.status] ?? session.status}
                    </span>
                  </div>
                  <p className="text-sm text-secondary"><span className="md:hidden">Mensajes: </span>{session.messageCount}</p>
                  <p className="text-sm text-muted">{formatDate(session.updatedAt)}</p>
                  <span className="hidden text-xl text-muted transition-transform group-hover:translate-x-1 md:block">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
