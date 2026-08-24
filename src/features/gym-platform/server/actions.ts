"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPublicGymPlatform, requireGymManager } from "./data";

export type GymActionState = { ok: boolean; message?: string };
type GymLoginMode = "member" | "manager";

function validSubdomain(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 63;
}

export async function loginGymPlatform(
  subdomain: string,
  mode: GymLoginMode,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  if (!validSubdomain(subdomain) || (mode !== "member" && mode !== "manager")) return { ok: false, message: "Acceso no válido." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 1 || password.length > 200) return { ok: false, message: "Correo o contraseña incorrectos." };
  const platform = await getPublicGymPlatform(subdomain);
  if (!platform) return { ok: false, message: "Esta plataforma no está disponible." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, message: "Correo o contraseña incorrectos." };

  const accessQuery = mode === "manager"
    ? supabase.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("organization_id", platform.site.organizationId).eq("user_id", data.user.id).eq("status", "active").in("role", ["owner", "admin"])
    : supabase.from("gym_customers").select("id", { count: "exact", head: true }).eq("organization_id", platform.site.organizationId).eq("user_id", data.user.id).in("status", ["active", "paused"]);
  const { count, error: accessError } = await accessQuery;
  if (accessError || !count) {
    await supabase.auth.signOut();
    return { ok: false, message: mode === "manager" ? "Tu cuenta no administra este gimnasio." : "Tu cuenta no tiene una membresía en este gimnasio." };
  }
  redirect(mode === "manager" ? "/gestion" : "/mi-cuenta");
}

export async function logoutGymPlatform(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateGymCustomerStatus(
  subdomain: string,
  customerId: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  if (!validSubdomain(subdomain) || !/^[0-9a-f-]{36}$/i.test(customerId)) return { ok: false, message: "Cliente no válido." };
  const status = String(formData.get("status") ?? "");
  if (!["lead", "active", "paused", "cancelled"].includes(status)) return { ok: false, message: "Estado no válido." };
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { data, error } = await access.supabase
    .from("gym_customers")
    .update({ status })
    .eq("id", customerId)
    .eq("organization_id", access.platform.site.organizationId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo actualizar al socio." };
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: "Estado actualizado." };
}
