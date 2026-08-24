"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PortalActionState = { ok: boolean; message?: string };

export async function loginPortal(_state: PortalActionState, formData: FormData): Promise<PortalActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 1 || password.length > 200) return { ok: false, message: "Correo o contraseña incorrectos." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, message: "Correo o contraseña incorrectos." };
  const { count, error: accessError } = await supabase.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("user_id", data.user.id).eq("status", "active");
  if (accessError || !count) {
    await supabase.auth.signOut();
    return { ok: false, message: "Tu cuenta no tiene un acceso activo. Contacta a ACTIIVA." };
  }
  redirect("/portal");
}

export async function activatePortalInvitations(): Promise<PortalActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claims?.claims?.sub !== "string") return { ok: false, message: "La invitación ya no es válida." };
  const { data, error } = await supabase.rpc("activate_own_organization_memberships");
  if (error) return { ok: false, message: "No pudimos activar tu acceso. Contacta a ACTIIVA." };
  if (typeof data !== "number" || data < 1) return { ok: false, message: "No encontramos una invitación pendiente para esta cuenta." };
  return { ok: true };
}

export async function logoutPortal(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}
