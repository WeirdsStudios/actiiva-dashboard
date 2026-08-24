"use client";

import { useActionState } from "react";
import { requestGymSchedule, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymClassDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

export function GymScheduleRequestForm({ subdomain, classes }: { subdomain: string; classes: GymClassDTO[] }) {
  const [state, formAction, pending] = useActionState(requestGymSchedule.bind(null, subdomain), initialState);
  return (
    <form action={formAction} className="gym-demand-form">
      <label>Formato<select name="classId" required defaultValue=""><option value="" disabled>Elige una clase</option>{classes.map((gymClass) => <option key={gymClass.id} value={gymClass.id}>{gymClass.name}</option>)}</select></label>
      <label>Día<select name="weekday" required defaultValue=""><option value="" disabled>Elige un día</option><option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option><option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="0">Domingo</option></select></label>
      <label>Momento<select name="timeWindow" required defaultValue=""><option value="" disabled>Elige un momento</option><option value="early">Antes de las 7</option><option value="morning">Mañana</option><option value="midday">Mediodía</option><option value="evening">Tarde</option><option value="night">Noche</option></select></label>
      <button type="submit" disabled={pending}>{pending ? "Enviando…" : "Pedir horario"}</button>
      {state.message ? <p className={state.ok ? "is-ok" : "is-error"} aria-live="polite">{state.message}</p> : null}
    </form>
  );
}
