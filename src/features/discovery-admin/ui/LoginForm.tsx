"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseAdminSetupFragment } from "@/lib/admin-invite";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { loginAdmin, type AdminActionState } from "../server/actions";

const initialState: AdminActionState = { ok: false };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, initialState);
  const [inviteState, setInviteState] = useState<"idle" | "validating" | "ready">("idle");
  const [inviteError, setInviteError] = useState<string>();
  const [savingPassword, setSavingPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const setup = parseAdminSetupFragment(window.location.hash);
    if (!setup) return;

    void Promise.resolve().then(() => setInviteState("validating"));
    const supabase = createSupabaseBrowserClient();
    void supabase.auth
      .setSession({ access_token: setup.accessToken, refresh_token: setup.refreshToken })
      .then(({ error }) => {
        window.history.replaceState(window.history.state, "", window.location.pathname);
        if (error) {
          setInviteState("idle");
          setInviteError("La invitación expiró o ya fue utilizada. Solicita una nueva invitación.");
          return;
        }
        setInviteState("ready");
      });
  }, []);

  async function setInitialPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(undefined);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");

    if (password.length < 12) {
      setInviteError("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setInviteError("Las contraseñas no coinciden.");
      return;
    }

    setSavingPassword(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSavingPassword(false);
      setInviteError("No pudimos guardar la contraseña. Intenta con una contraseña diferente.");
      return;
    }

    router.replace("/admin/discovery");
    router.refresh();
  }

  if (inviteState === "validating") {
    return <p className="rounded-lg bg-surface px-4 py-4 text-sm text-secondary">Validando tu invitación…</p>;
  }

  if (inviteState === "ready") {
    return (
      <form onSubmit={setInitialPassword} className="flex flex-col gap-5">
        <p className="rounded-lg bg-success-surface px-4 py-3 text-sm text-success">
          Invitación confirmada. Crea tu contraseña para terminar el acceso.
        </p>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Nueva contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            required
            className="h-12 rounded-lg border border-border bg-surface px-4 font-normal"
          />
          <span className="text-xs font-normal text-muted">Usa al menos 12 caracteres.</span>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Confirmar contraseña
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            required
            className="h-12 rounded-lg border border-border bg-surface px-4 font-normal"
          />
        </label>
        {inviteError && <p className="rounded-lg bg-danger-surface px-4 py-3 text-sm text-danger">{inviteError}</p>}
        <button
          type="submit"
          disabled={savingPassword}
          className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {savingPassword ? "Guardando…" : "Crear contraseña y entrar"}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        Correo
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-12 rounded-lg border border-border bg-surface px-4 font-normal"
          placeholder="tu@actiiva.mx"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-lg border border-border bg-surface px-4 font-normal"
        />
      </label>
      {(inviteError ?? state.message) && (
        <p className="rounded-lg bg-danger-surface px-4 py-3 text-sm text-danger">{inviteError ?? state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Verificando…" : "Entrar al panel"}
      </button>
    </form>
  );
}
