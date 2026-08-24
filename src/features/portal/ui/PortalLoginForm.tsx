"use client";

import { useActionState } from "react";
import { loginPortal, type PortalActionState } from "../server/actions";

const initialState: PortalActionState = { ok: false };

export function PortalLoginForm() {
  const [state, action, pending] = useActionState(loginPortal, initialState);
  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">Correo<input name="email" type="email" autoComplete="email" required className="h-12 rounded-lg border border-border bg-surface px-4 font-normal" /></label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">Contraseña<input name="password" type="password" autoComplete="current-password" required className="h-12 rounded-lg border border-border bg-surface px-4 font-normal" /></label>
      {state.message && <p className="rounded-lg bg-danger-surface px-4 py-3 text-sm text-danger">{state.message}</p>}
      <button type="submit" disabled={pending} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{pending ? "Entrando…" : "Entrar a mi cuenta"}</button>
    </form>
  );
}
