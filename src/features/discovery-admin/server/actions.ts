"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, isConfiguredAdminEmail } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AdminActionState = { ok: boolean; message?: string; link?: string };

async function requestBaseUrl(): Promise<string> {
  if (process.env.DISCOVERY_BASE_URL) return process.env.DISCOVERY_BASE_URL.replace(/\/$/, "");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

function generateAccessToken(): string {
  return `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
}

export async function loginAdmin(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || password.length > 200 || !isConfiguredAdminEmail(email)) {
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: "Correo o contraseña incorrectos." };

  redirect("/admin/discovery");
}

export async function logoutAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createDiscoverySessionFromAdmin(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await assertAdmin();
  const businessName = String(formData.get("businessName") ?? "").trim();
  if (businessName.length > 120) return { ok: false, message: "El nombre debe tener menos de 120 caracteres." };

  const { data, error } = await supabaseAdmin
    .from("discovery_sessions")
    .insert({
      pack_id: "question-pack-actiiva",
      pack_version: "0.2.0",
      ...(businessName ? { business_name_draft: businessName } : {}),
    })
    .select("id, access_token")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "No se pudo crear la sesión." };

  revalidatePath("/admin/discovery");
  return { ok: true, message: "Sesión creada.", link: `${await requestBaseUrl()}/discovery/${data.access_token}` };
}

export async function renewDiscoveryLink(sessionId: string): Promise<AdminActionState> {
  await assertAdmin();
  const accessToken = generateAccessToken();
  const { data: current, error: readError } = await supabaseAdmin
    .from("discovery_sessions")
    .select("submitted_at, reopen_authorized_until")
    .eq("id", sessionId)
    .maybeSingle();
  if (readError || !current) return { ok: false, message: readError?.message ?? "No se encontró la sesión." };

  const expiryCandidates = [Date.now() + 7 * 24 * 60 * 60 * 1000];
  if (current.submitted_at) expiryCandidates.push(new Date(current.submitted_at).getTime() + 20 * 24 * 60 * 60 * 1000);
  if (current.reopen_authorized_until) expiryCandidates.push(new Date(current.reopen_authorized_until).getTime());
  const tokenExpiresAt = new Date(Math.max(...expiryCandidates)).toISOString();
  const { error } = await supabaseAdmin
    .from("discovery_sessions")
    .update({ access_token: accessToken, token_expires_at: tokenExpiresAt })
    .eq("id", sessionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/discovery/${sessionId}`);
  return { ok: true, message: "Enlace renovado por 7 días.", link: `${await requestBaseUrl()}/discovery/${accessToken}` };
}

export async function authorizeDiscoveryReopen(sessionId: string, days = 20): Promise<AdminActionState> {
  await assertAdmin();
  if (!Number.isInteger(days) || days < 1 || days > 60) return { ok: false, message: "El plazo no es válido." };
  const { data: current, error: readError } = await supabaseAdmin
    .from("discovery_sessions")
    .select("reopen_requested_at, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (readError || !current) return { ok: false, message: readError?.message ?? "No se encontró la sesión." };
  if (!current.reopen_requested_at || current.status === "approved") {
    return { ok: false, message: "Esta sesión no tiene una solicitud de reapertura pendiente." };
  }
  const authorizedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("discovery_sessions")
    .update({
      reopen_authorized_until: authorizedUntil,
      reopen_requested_at: null,
      token_expires_at: authorizedUntil,
    })
    .eq("id", sessionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/discovery/${sessionId}`);
  return { ok: true, message: `Sesión reabierta por ${days} días.` };
}

export async function approveDiscoverySession(sessionId: string): Promise<AdminActionState> {
  await assertAdmin();
  const { data, error } = await supabaseAdmin
    .from("discovery_sessions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Sólo se puede aprobar una sesión enviada." };

  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/discovery/${sessionId}`);
  return { ok: true, message: "Sesión aprobada internamente." };
}
