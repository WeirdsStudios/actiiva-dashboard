"use client";

import { useActionState } from "react";
import { updateGymPlan, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymPlanDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

export function GymPlanSettingsForm({ subdomain, plan }: { subdomain: string; plan: GymPlanDTO }) {
  const action = updateGymPlan.bind(null, subdomain, plan.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="gym-plan-settings">
    <header><div><strong>{plan.name}</strong><small>{plan.published ? "Visible en sitio" : "Borrador"}</small></div><label>Precio MXN<input name="pricePesos" type="number" min="0" step="0.01" defaultValue={plan.priceCents / 100} /></label></header>
    <div className="gym-plan-settings-grid">
      <label>Duración<input name="durationCount" type="number" min="1" max="365" defaultValue={plan.durationCount} /></label>
      <label>Unidad<select name="durationUnit" defaultValue={plan.durationUnit}><option value="day">Días</option><option value="week">Semanas</option><option value="month">Meses</option><option value="year">Años</option></select></label>
      <label>Acceso a clases<select name="classAccess" defaultValue={plan.classAccess}><option value="unlimited">Ilimitado</option><option value="credits">Por créditos</option><option value="none">Sin clases</option></select></label>
      <label>Créditos<input name="classCredits" type="number" min="1" max="1000" defaultValue={plan.classCredits ?? ""} placeholder="Sólo si aplica" /></label>
      <label>Tolerancia en días<input name="graceDays" type="number" min="0" max="90" defaultValue={plan.graceDays} /></label>
      <label className="gym-check-field"><input name="autoRenewAvailable" type="checkbox" defaultChecked={plan.autoRenewAvailable} /> Preparado para autorrenovación</label>
    </div>
    <button disabled={pending}>{pending ? "Guardando…" : "Guardar plan"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
