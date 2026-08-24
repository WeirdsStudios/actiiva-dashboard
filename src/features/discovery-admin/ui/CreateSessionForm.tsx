"use client";

import { useActionState, useState } from "react";
import { createDiscoverySessionFromAdmin, type AdminActionState } from "../server/actions";

const initialState: AdminActionState = { ok: false };

export function CreateSessionForm() {
  const [state, action, pending] = useActionState(createDiscoverySessionFromAdmin, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.link) return;
    await navigator.clipboard.writeText(state.link);
    setCopied(true);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Nueva entrada</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Crear enlace de onboarding</h2>
      </div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <input
          name="businessName"
          maxLength={120}
          className="h-11 flex-1 rounded-lg border border-border bg-canvas px-4 text-sm"
          placeholder="Nombre del negocio (opcional)"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear sesión"}
        </button>
      </form>
      {state.message && (
        <p className={`mt-3 text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>
      )}
      {state.link && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-signal-soft p-3">
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">{state.link}</code>
          <button type="button" onClick={copyLink} className="shrink-0 text-sm font-semibold text-secondary">
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
