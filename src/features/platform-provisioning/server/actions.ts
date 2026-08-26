"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidTenantSubdomain } from "@/lib/tenant-routing";
import { inviteOrganizationMember } from "@/features/organizations/server/actions";
import { buildPlatformDraft } from "../lib/discovery-platform";

export type PlatformProvisioningActionState = {
  ok: boolean;
  message?: string;
  subdomain?: string;
};

const INITIAL_STATE: PlatformProvisioningActionState = { ok: false };

function platformError(message: string): string {
  if (message.includes("duplicate key") && message.includes("subdomain")) return "Ese subdominio ya pertenece a otro negocio.";
  if (message.includes("approved linked discovery")) return "El onboarding aprobado ya no está vinculado a este cliente.";
  if (message.includes("another source")) return "Este cliente ya tiene una plataforma creada desde otro onboarding.";
  return "No se pudo preparar la plataforma. Ningún dato parcial fue publicado.";
}

function publicationError(message: string): string {
  if (message.includes("active owner")) return "El propietario debe aceptar su invitación antes de publicar.";
  if (message.includes("published offering")) return "Hace falta al menos un plan o servicio con precio antes de publicar.";
  if (message.includes("published class")) return "Hace falta al menos una clase con horario antes de publicar.";
  if (message.includes("active branch")) return "Hace falta una sucursal activa antes de publicar.";
  return "La plataforma todavía no cumple todos los requisitos de publicación.";
}

export async function provisionOrganizationPlatform(
  organizationId: string,
  sourceSessionId: string,
  _state: PlatformProvisioningActionState,
  formData: FormData,
): Promise<PlatformProvisioningActionState> {
  void _state;
  const admin = await assertAdmin();
  const subdomain = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  if (!isValidTenantSubdomain(subdomain)) {
    return { ok: false, message: "Usa un subdominio disponible con letras minúsculas, números o guiones." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) || ownerEmail.length > 254) {
    return { ok: false, message: "Escribe el correo válido del propietario." };
  }

  const [{ data: organization, error: organizationError }, { data: session, error: sessionError }, { data: responses, error: responsesError }] = await Promise.all([
    supabaseAdmin.from("organizations").select("id, name, status").eq("id", organizationId).maybeSingle(),
    supabaseAdmin.from("discovery_sessions").select("id, tenant_id, status").eq("id", sourceSessionId).maybeSingle(),
    supabaseAdmin.from("discovery_responses").select("question_id, status, value").eq("session_id", sourceSessionId),
  ]);
  if (organizationError || !organization || organization.status !== "active") return { ok: false, message: "El cliente ya no está activo." };
  if (sessionError || !session || session.tenant_id !== organizationId || session.status !== "approved") {
    return { ok: false, message: "Sólo puedes usar un onboarding aprobado y vinculado a este cliente." };
  }
  if (responsesError) return { ok: false, message: "No se pudo leer la información aprobada del onboarding." };

  const draft = buildPlatformDraft(organization.name, responses ?? []);
  const { data, error } = await supabaseAdmin.rpc("provision_organization_gym_platform", {
    p_organization_id: organizationId,
    p_source_session_id: sourceSessionId,
    p_subdomain: subdomain,
    p_site_name: draft.siteName,
    p_tagline: draft.tagline,
    p_description: draft.description,
    p_address: draft.address,
    p_phone: draft.phone,
    p_primary_color: draft.primaryColor,
    p_accent_color: draft.accentColor,
    p_plans: draft.plans,
    p_classes: draft.classes,
    p_drop_in_price_cents: draft.dropInPriceCents,
    p_actor_id: admin.userId,
  });
  if (error) return { ok: false, message: platformError(error.message) };

  const inviteData = new FormData();
  inviteData.set("email", ownerEmail);
  inviteData.set("role", "owner");
  const invitation = await inviteOrganizationMember(organizationId, INITIAL_STATE, inviteData);
  const result = data && typeof data === "object" ? data as { subdomain?: unknown } : null;
  const storedSubdomain = typeof result?.subdomain === "string" ? result.subdomain : subdomain;

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${organizationId}`);
  return {
    ok: true,
    subdomain: storedSubdomain,
    message: invitation.ok
      ? `Plataforma preparada. ${invitation.message}`
      : `La plataforma quedó en borrador, pero falta invitar al propietario: ${invitation.message}`,
  };
}

export async function publishOrganizationPlatform(
  organizationId: string,
  _state: PlatformProvisioningActionState,
  _formData: FormData,
): Promise<PlatformProvisioningActionState> {
  void _state;
  void _formData;
  const admin = await assertAdmin();
  const { data, error } = await supabaseAdmin.rpc("publish_organization_gym_platform", {
    p_organization_id: organizationId,
    p_actor_id: admin.userId,
  });
  if (error) return { ok: false, message: publicationError(error.message) };
  const result = data && typeof data === "object" ? data as { subdomain?: unknown } : null;
  const subdomain = typeof result?.subdomain === "string" ? result.subdomain : undefined;
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${organizationId}`);
  if (subdomain) revalidatePath(`/sites/${subdomain}`);
  return { ok: true, subdomain, message: "Plataforma publicada. Las tres experiencias ya están disponibles." };
}
