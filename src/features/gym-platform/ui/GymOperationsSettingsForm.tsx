"use client";

import { useActionState } from "react";
import { updateGymOperationsSettings, type GymActionState } from "@/features/gym-platform/server/actions";

const initialState: GymActionState = { ok: false };

export function GymOperationsSettingsForm({ subdomain, threshold, holdHours }: { subdomain: string; threshold: number; holdHours: number }) {
  const action = updateGymOperationsSettings.bind(null, subdomain);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="gym-operations-settings">
    <label>Personas para activar demanda<input name="scheduleInterestThreshold" type="number" min="2" max="50" defaultValue={threshold} /></label>
    <label>Vigencia del apartado<input name="demandHoldHours" type="number" min="1" max="168" defaultValue={holdHours} /><small>horas</small></label>
    <button disabled={pending}>{pending ? "Guardando…" : "Guardar reglas"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
