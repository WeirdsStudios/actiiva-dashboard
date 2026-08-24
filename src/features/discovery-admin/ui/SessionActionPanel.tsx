"use client";

import { useState, useTransition } from "react";
import {
  approveDiscoverySession,
  authorizeDiscoveryReopen,
  renewDiscoveryLink,
  type AdminActionState,
} from "../server/actions";

export function SessionActionPanel({ sessionId, status, reopenRequested }: { sessionId: string; status: string; reopenRequested: boolean }) {
  const [result, setResult] = useState<AdminActionState | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AdminActionState>) {
    setCopied(false);
    startTransition(async () => setResult(await action()));
  }

  async function copyLink() {
    if (!result?.link) return;
    await navigator.clipboard.writeText(result.link);
    setCopied(true);
  }

  return (
    <aside className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Acciones seguras</p>
      <div className="mt-4 flex flex-col gap-2">
        {reopenRequested && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => authorizeDiscoveryReopen(sessionId))}
            className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Autorizar reapertura por 20 días
          </button>
        )}
        {status === "submitted" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveDiscoverySession(sessionId))}
            className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Aprobar información
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("El enlace anterior dejará de funcionar. ¿Crear uno nuevo?")) {
              run(() => renewDiscoveryLink(sessionId));
            }
          }}
          className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-secondary disabled:opacity-50"
        >
          Renovar enlace por 7 días
        </button>
      </div>
      {pending && <p className="mt-3 text-sm text-muted">Aplicando cambio…</p>}
      {result?.message && (
        <p className={`mt-3 text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p>
      )}
      {result?.link && (
        <div className="mt-3 rounded-lg bg-signal-soft p-3">
          <code className="block truncate text-xs">{result.link}</code>
          <button type="button" onClick={copyLink} className="mt-2 text-sm font-semibold text-secondary">
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
        </div>
      )}
    </aside>
  );
}
