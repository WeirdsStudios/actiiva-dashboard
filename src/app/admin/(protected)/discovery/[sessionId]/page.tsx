import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDiscoverySession } from "@/features/discovery-admin/server/data";
import { SessionActionPanel } from "@/features/discovery-admin/ui/SessionActionPanel";

const STATUS_LABELS: Record<string, string> = { in_progress: "En conversación", submitted: "En revisión", approved: "Aprobada" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function AdminDiscoveryDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const result = await getAdminDiscoverySession(sessionId);
  if (!result) notFound();
  const { session, responses, assets, latestExports } = result;
  const grouped = new Map<string, typeof responses>();
  for (const response of responses) {
    const current = grouped.get(response.section_id) ?? [];
    current.push(response);
    grouped.set(response.section_id, current);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/admin/discovery" className="text-sm font-medium text-secondary hover:text-foreground">← Volver a sesiones</Link>

      <header className="mt-6 border-b border-border pb-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-secondary">{STATUS_LABELS[session.status] ?? session.status}</span>
              <span className="text-xs text-muted">Pack {session.pack_version}</span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-foreground">{session.business_name_draft || "Negocio sin nombre"}</h1>
            <p className="mt-2 text-sm text-muted">Sesión creada el {formatDate(session.created_at)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label="Línea de vida de la sesión">
            {[["Creada", session.created_at], ["Enviada", session.submitted_at], ["Aprobada", session.approved_at]].map(([label, date], index) => (
              <div key={label} className={`min-w-24 border-t-2 pt-2 ${date ? "border-primary" : "border-border"}`}>
                <span className="block text-xs font-semibold text-foreground">{label}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{date ? formatDate(date) : index === 1 ? "Pendiente" : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <div className="flex items-end justify-between border-b border-border pb-3">
              <div><p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Información capturada</p><h2 className="mt-1 text-2xl font-semibold text-foreground">Respuestas</h2></div>
              <span className="text-sm text-muted">{responses.length} datos</span>
            </div>
            {responses.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">La conversación todavía no ha guardado respuestas.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {[...grouped.entries()].map(([sectionId, sectionResponses]) => (
                  <details key={sectionId} open className="rounded-xl border border-border bg-surface">
                    <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">{sectionId.replaceAll("-", " ")} · {sectionResponses.length}</summary>
                    <div className="divide-y divide-border border-t border-border">
                      {sectionResponses.map((response) => (
                        <div key={response.question_id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                          <div><p className="text-sm text-secondary">{response.prompt}</p><p className="mt-1 text-[11px] text-muted">{response.status} · {response.source}</p></div>
                          <pre className="overflow-x-auto whitespace-pre-wrap font-sans text-sm text-foreground">{formatValue(response.value)}</pre>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="border-b border-border pb-3"><p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Salidas del proceso</p><h2 className="mt-1 text-2xl font-semibold text-foreground">Exportación más reciente</h2></div>
            {!latestExports ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Se generará cuando el negocio cierre la conversación.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <p className="mb-2 text-xs text-muted">Generada el {formatDate(latestExports.generatedAt)}</p>
                {latestExports.documents.map((document) => (
                  <details key={document.documentName} className="rounded-lg border border-border bg-surface">
                    <summary className="cursor-pointer px-4 py-3 font-mono text-xs text-secondary">{document.documentName}</summary>
                    <pre className="max-h-96 overflow-auto border-t border-border bg-canvas p-4 text-xs leading-5">{JSON.stringify(document.content, null, 2)}</pre>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <SessionActionPanel sessionId={session.id} status={session.status} reopenRequested={Boolean(session.reopen_requested_at)} />
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Control de acceso</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-muted">Enlace vigente hasta</dt><dd className="mt-0.5 font-medium text-foreground">{formatDate(session.token_expires_at)}</dd></div>
              <div><dt className="text-muted">Mensajes procesados</dt><dd className="mt-0.5 font-medium text-foreground">{session.message_count ?? 0} de 300</dd></div>
              <div><dt className="text-muted">Reapertura autorizada hasta</dt><dd className="mt-0.5 font-medium text-foreground">{formatDate(session.reopen_authorized_until)}</dd></div>
            </dl>
          </section>
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Archivos</p>
            {assets.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay archivos.</p> : (
              <ul className="mt-3 space-y-3">{assets.map((asset) => <li key={asset.id}><p className="truncate text-sm font-medium text-foreground">{asset.original_filename || "Archivo"}</p><p className="text-xs text-muted">{asset.mime_type} · {Math.ceil((asset.size_bytes ?? 0) / 1024)} KB</p></li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
