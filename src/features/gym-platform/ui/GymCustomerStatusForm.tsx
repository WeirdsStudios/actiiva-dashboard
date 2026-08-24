"use client";

import { useActionState } from "react";
import { updateGymCustomerStatus, type GymActionState } from "../server/actions";

const initialState: GymActionState = { ok: false };

export function GymCustomerStatusForm({ subdomain, customerId, status }: { subdomain: string; customerId: string; status: string }) {
  const [state, action, pending] = useActionState(updateGymCustomerStatus.bind(null, subdomain, customerId), initialState);
  return (
    <form action={action} className="gym-status-form">
      <select name="status" defaultValue={status} aria-label="Estado del socio">
        <option value="lead">Prospecto</option>
        <option value="active">Activo</option>
        <option value="paused">En pausa</option>
        <option value="cancelled">Cancelado</option>
      </select>
      <button type="submit" disabled={pending}>{pending ? "…" : "Guardar"}</button>
      {state.message ? <span className={state.ok ? "is-ok" : "is-error"}>{state.message}</span> : null}
    </form>
  );
}
