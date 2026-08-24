"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  normalizeMemberEmail,
  parseOrganizationMemberStatus,
  parseOrganizationRole,
  type OrganizationMemberStatus,
  type OrganizationRole,
} from "../lib/member-access";

export type MemberAccessActionState = { ok: boolean; message?: string };

function portalSetupUrl(): string {
  const baseUrl = (process.env.DISCOVERY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/portal/setup`;
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("No se pudo comprobar el usuario en Supabase Auth.");
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new Error("No se pudo completar la búsqueda del usuario.");
}

async function setMemberAccess(input: {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  adminUserId: string;
}): Promise<string | null> {
  const { error } = await supabaseAdmin.rpc("set_organization_member_access", {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_role: input.role,
    p_status: input.status,
    p_added_by: input.adminUserId,
  });
  if (!error) return null;
  if (error.message.includes("keep one active owner")) return "La cuenta debe conservar al menos un propietario activo.";
  return "No se pudo actualizar el acceso. La cuenta no fue modificada.";
}

export async function inviteOrganizationMember(
  organizationId: string,
  _state: MemberAccessActionState,
  formData: FormData,
): Promise<MemberAccessActionState> {
  const admin = await assertAdmin();
  const email = normalizeMemberEmail(formData.get("email"));
  const role = parseOrganizationRole(formData.get("role"));
  if (!email || !role) return { ok: false, message: "Revisa el correo y el rol seleccionados." };

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError || !organization) return { ok: false, message: "El cliente ya no está disponible." };

  let user = await findAuthUserByEmail(email);
  let createdForInvite = false;
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: portalSetupUrl() });
    if (error || !data.user) return { ok: false, message: "No se pudo enviar la invitación. Intenta nuevamente." };
    user = data.user;
    createdForInvite = true;
  }

  const alreadyConfirmed = Boolean(user.email_confirmed_at || user.last_sign_in_at);
  const status: OrganizationMemberStatus = alreadyConfirmed ? "active" : "invited";
  const accessError = await setMemberAccess({ organizationId, userId: user.id, role, status, adminUserId: admin.userId });
  if (accessError) {
    if (createdForInvite) await supabaseAdmin.auth.admin.deleteUser(user.id);
    return { ok: false, message: accessError };
  }

  revalidatePath(`/admin/clients/${organizationId}`);
  if (createdForInvite) return { ok: true, message: `Invitación enviada a ${email}.` };
  if (alreadyConfirmed) return { ok: true, message: `${email} ya tenía cuenta; su acceso quedó activo.` };
  return { ok: true, message: `${email} ya tenía una invitación pendiente; su acceso quedó asignado sin enviar otro correo.` };
}

export async function updateOrganizationMemberAccess(
  organizationId: string,
  userId: string,
  _state: MemberAccessActionState,
  formData: FormData,
): Promise<MemberAccessActionState> {
  const admin = await assertAdmin();
  const role = parseOrganizationRole(formData.get("role"));
  const status = parseOrganizationMemberStatus(formData.get("status"));
  if (!role || !status) return { ok: false, message: "El rol o estado no es válido." };

  const accessError = await setMemberAccess({ organizationId, userId, role, status, adminUserId: admin.userId });
  if (accessError) return { ok: false, message: accessError };
  revalidatePath(`/admin/clients/${organizationId}`);
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Acceso actualizado." };
}
