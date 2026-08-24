"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseAdminSetupFragment } from "@/lib/admin-invite";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { activatePortalInvitations } from "../server/actions";

export function PortalSetupForm() {
  const [setupState, setSetupState] = useState<"validating" | "ready" | "invalid">("validating");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const setup = parseAdminSetupFragment(window.location.hash);
    if (!setup || setup.flow !== "invite") {
      Promise.resolve().then(() => setSetupState("invalid"));
      return;
    }
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.setSession({ access_token: setup.accessToken, refresh_token: setup.refreshToken }).then(({ error }) => {
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setSetupState(error ? "invalid" : "ready");
    });
  }, []);

  async function finishSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");
    if (password.length < 12) return setErrorMessage("La contraseña debe tener al menos 12 caracteres.");
    if (password !== confirmation) return setErrorMessage("Las contraseñas no coinciden.");
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      setErrorMessage("No pudimos guardar la contraseña. Intenta con una contraseña diferente.");
      return;
    }
    const activation = await activatePortalInvitations();
    if (!activation.ok) {
      setSaving(false);
      setErrorMessage(activation.message);
      return;
    }
    router.replace("/portal");
    router.refresh();
  }

  if (setupState === "validating") return <p className="rounded-lg bg-surface px-4 py-4 text-sm text-secondary">Validando tu invitación…</p>;
  if (setupState === "invalid") return <p className="rounded-lg bg-danger-surface px-4 py-4 text-sm text-danger">La invitación expiró o ya fue utilizada. Solicita una nueva a ACTIIVA.</p>;
  return (
    <form onSubmit={finishSetup} className="flex flex-col gap-5">
      <p className="rounded-lg bg-success-surface px-4 py-3 text-sm text-success">Invitación confirmada. Crea tu contraseña para terminar.</p>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className="h-12 rounded-lg border border-border bg-surface px-4 font-normal" /><span className="text-xs font-normal text-muted">Usa al menos 12 caracteres.</span></label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">Confirmar contraseña<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className="h-12 rounded-lg border border-border bg-surface px-4 font-normal" /></label>
      {errorMessage && <p className="rounded-lg bg-danger-surface px-4 py-3 text-sm text-danger">{errorMessage}</p>}
      <button type="submit" disabled={saving} className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{saving ? "Activando…" : "Crear contraseña y entrar"}</button>
    </form>
  );
}
