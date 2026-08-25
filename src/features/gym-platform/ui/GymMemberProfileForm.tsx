"use client";

import { useActionState } from "react";
import { updateGymMemberProfile, type GymActionState } from "@/features/gym-platform/server/actions";

const initialState: GymActionState = { ok: false };

export function GymMemberProfileForm({ subdomain, name, phone, email }: { subdomain: string; name: string; phone: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateGymMemberProfile.bind(null, subdomain), initialState);
  return <form action={formAction} className="gym-member-profile-form">
    <div><p className="gym-panel-label">Tu perfil</p><h2>Datos de contacto</h2><span>El teléfono permite recibir avisos del gimnasio por WhatsApp.</span></div>
    <label>Nombre<input name="name" defaultValue={name} maxLength={120} required /></label>
    <label>WhatsApp<input name="phone" type="tel" defaultValue={phone} maxLength={24} placeholder="+52 55 1234 5678" /></label>
    <label>Correo<input value={email} disabled /></label>
    <button disabled={pending}>{pending ? "Guardando…" : "Guardar perfil"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
