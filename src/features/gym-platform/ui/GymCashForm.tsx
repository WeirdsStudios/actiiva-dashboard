"use client";

import { useActionState } from "react";
import { closeGymCashSession, openGymCashSession, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymBranchDTO, GymCashSessionDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

export function GymCashForm({ subdomain, branches, session }: { subdomain: string; branches: GymBranchDTO[]; session: GymCashSessionDTO | null }) {
  const action = session ? closeGymCashSession.bind(null, subdomain, session.id) : openGymCashSession.bind(null, subdomain);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="gym-cash-form">
    <div><span>{session ? "Caja abierta" : "Caja cerrada"}</span><strong>{session ? "Fondo " + money(session.openingAmountCents) : "Abre un turno para aceptar efectivo"}</strong></div>
    {!session ? <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} /> : null}
    <label>{session ? "Efectivo contado" : "Fondo inicial"}<div><span>$</span><input name={session ? "closingAmountPesos" : "openingAmountPesos"} type="number" min="0" step="0.01" defaultValue="0" aria-label="Monto en pesos" /><small>MXN</small></div></label>
    <button disabled={pending || !branches.length}>{pending ? "Procesando…" : session ? "Cerrar y conciliar" : "Abrir caja"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
