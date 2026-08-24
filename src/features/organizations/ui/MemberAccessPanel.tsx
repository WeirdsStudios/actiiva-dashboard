"use client";

import { useActionState } from "react";
import { inviteOrganizationMember, updateOrganizationMemberAccess, type MemberAccessActionState } from "../server/actions";

const initialState: MemberAccessActionState = { ok: false };
const ROLE_LABELS = { owner: "Propietario", admin: "Administrador", member: "Miembro" } as const;
const STATUS_LABELS = { invited: "Invitado", active: "Activo", disabled: "Deshabilitado" } as const;

export interface MemberAccessItem {
  user_id: string;
  email: string | null;
  role: keyof typeof ROLE_LABELS;
  status: keyof typeof STATUS_LABELS;
}

export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(inviteOrganizationMember.bind(null, organizationId), initialState);
  return (
    <form action={action} className="mt-5 rounded-xl border border-border bg-canvas p-4">
      <label className="block text-xs font-semibold tracking-[0.12em] text-muted uppercase" htmlFor="member-email">Invitar persona</label>
      <input id="member-email" name="email" type="email" autoComplete="email" required placeholder="persona@negocio.mx" className="mt-3 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground" />
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <select name="role" defaultValue="owner" className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-foreground">
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="submit" disabled={pending} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{pending ? "Enviando…" : "Invitar"}</button>
      </div>
      {state.message && <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${state.ok ? "bg-success-surface text-success" : "bg-danger-surface text-danger"}`}>{state.message}</p>}
    </form>
  );
}

export function MemberAccessList({ organizationId, members }: { organizationId: string; members: MemberAccessItem[] }) {
  if (members.length === 0) return <p className="mt-4 text-sm leading-6 text-secondary">Aún no hay personas con acceso.</p>;
  return <ul className="mt-4 space-y-3">{members.map((member) => <MemberAccessRow key={member.user_id} organizationId={organizationId} member={member} />)}</ul>;
}

function MemberAccessRow({ organizationId, member }: { organizationId: string; member: MemberAccessItem }) {
  const [state, action, pending] = useActionState(updateOrganizationMemberAccess.bind(null, organizationId, member.user_id), initialState);
  return (
    <li className="rounded-xl border border-border p-3">
      <p className="truncate text-sm font-medium text-foreground">{member.email ?? "Usuario sin correo"}</p>
      <form action={action} className="mt-3 grid grid-cols-2 gap-2">
        <select name="role" defaultValue={member.role} aria-label={`Rol de ${member.email ?? "usuario"}`} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-secondary">
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="status" defaultValue={member.status} aria-label={`Estado de ${member.email ?? "usuario"}`} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-secondary">
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="submit" disabled={pending} className="col-span-2 h-9 rounded-lg bg-surface-subtle text-xs font-semibold text-secondary hover:text-foreground disabled:opacity-50">{pending ? "Guardando…" : "Guardar acceso"}</button>
      </form>
      {state.message && <p className={`mt-2 text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
    </li>
  );
}
