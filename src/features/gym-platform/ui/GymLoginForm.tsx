"use client";

import { useActionState } from "react";
import { loginGymPlatform, type GymActionState } from "../server/actions";

const initialState: GymActionState = { ok: false };

export function GymLoginForm({ subdomain, mode }: { subdomain: string; mode: "member" | "manager" }) {
  const [state, action, pending] = useActionState(loginGymPlatform.bind(null, subdomain, mode), initialState);
  return (
    <form action={action} className="gym-login-form">
      <label>Correo<input name="email" type="email" autoComplete="email" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {state.message ? <p className="gym-form-error">{state.message}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Entrando…" : mode === "manager" ? "Entrar a gestión" : "Entrar a mi cuenta"}</button>
    </form>
  );
}
