"use client";

import { useActionState } from "react";
import { approveGymDemand, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymBranchDTO, GymDemandDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

export function GymDemandApprovalForm({ subdomain, demand, branches }: { subdomain: string; demand: GymDemandDTO; branches: GymBranchDTO[] }) {
  const action = approveGymDemand.bind(null, subdomain, demand.classId, demand.weekday, demand.timeWindow);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="gym-demand-approval">
    <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} />
    <label>Fecha y hora<input name="startsAt" type="datetime-local" required /></label>
    <label>Cupo<input name="capacity" type="number" min="1" max="200" defaultValue={Math.max(demand.requestCount, demand.threshold)} required /></label>
    <label>Precio MXN<input name="pricePesos" type="number" min="0" step="0.01" defaultValue="0" /><small>0 si está incluida</small></label>
    <button disabled={pending || !demand.ready}>{pending ? "Autorizando…" : "Autorizar y apartar"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
