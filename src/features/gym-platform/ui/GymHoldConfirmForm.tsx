"use client";

import { useActionState } from "react";
import { confirmGymClassHold, type GymActionState } from "@/features/gym-platform/server/actions";

const initialState: GymActionState = { ok: false };

export function GymHoldConfirmForm({ subdomain, token, disabled }: { subdomain: string; token: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(confirmGymClassHold.bind(null, subdomain, token), initialState);
  return <form action={formAction} className="gym-hold-confirm-form">
    <button disabled={pending || disabled}>{pending ? "Confirmando…" : disabled ? "Confirmado" : "Confirmar mi lugar"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
