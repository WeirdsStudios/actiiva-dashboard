import "server-only";

import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildPlatformDraft } from "@/features/platform-provisioning/lib/discovery-platform";

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  discoveryCount: number;
  latestDiscoveryStatus: string | null;
  latestDiscoveryUpdatedAt: string | null;
  platformStatus: string | null;
  platformSubdomain: string | null;
}

export async function listAdminOrganizations(): Promise<AdminOrganizationSummary[]> {
  await requireAdmin();

  const { data: organizations, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug, status, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los clientes: ${error.message}`);

  const organizationIds = (organizations ?? []).map((organization) => organization.id);
  if (organizationIds.length === 0) return [];

  const [{ data: sessions, error: sessionError }, { data: members, error: memberError }, { data: sites, error: siteError }] = await Promise.all([
    supabaseAdmin
      .from("discovery_sessions")
      .select("tenant_id, status, updated_at")
      .in("tenant_id", organizationIds)
      .order("updated_at", { ascending: false }),
    supabaseAdmin.from("organization_members").select("organization_id").in("organization_id", organizationIds),
    supabaseAdmin.from("organization_sites").select("organization_id, subdomain, status").in("organization_id", organizationIds),
  ]);
  if (sessionError) throw new Error(`No se pudieron cargar los onboardings de clientes: ${sessionError.message}`);
  if (memberError) throw new Error(`No se pudieron cargar los miembros: ${memberError.message}`);
  if (siteError) throw new Error(`No se pudieron cargar las plataformas: ${siteError.message}`);

  const sessionsByOrganization = new Map<string, Array<{ status: string; updated_at: string }>>();
  for (const session of sessions ?? []) {
    if (!session.tenant_id) continue;
    const current = sessionsByOrganization.get(session.tenant_id) ?? [];
    current.push({ status: session.status, updated_at: session.updated_at });
    sessionsByOrganization.set(session.tenant_id, current);
  }

  const membersByOrganization = new Map<string, number>();
  for (const member of members ?? []) {
    membersByOrganization.set(member.organization_id, (membersByOrganization.get(member.organization_id) ?? 0) + 1);
  }
  const siteByOrganization = new Map((sites ?? []).map((site) => [site.organization_id, site]));

  return (organizations ?? []).map((organization) => {
    const linkedSessions = sessionsByOrganization.get(organization.id) ?? [];
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      createdAt: organization.created_at,
      updatedAt: organization.updated_at,
      memberCount: membersByOrganization.get(organization.id) ?? 0,
      discoveryCount: linkedSessions.length,
      latestDiscoveryStatus: linkedSessions[0]?.status ?? null,
      latestDiscoveryUpdatedAt: linkedSessions[0]?.updated_at ?? null,
      platformStatus: siteByOrganization.get(organization.id)?.status ?? null,
      platformSubdomain: siteByOrganization.get(organization.id)?.subdomain ?? null,
    };
  });
}

export async function getAdminOrganization(organizationId: string) {
  await requireAdmin();

  const [
    organizationResult, sessionsResult, membersResult, siteResult,
    branchesResult, plansResult, classesResult, offeringsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("id, name, slug, status, created_by, created_at, updated_at")
      .eq("id", organizationId)
      .maybeSingle(),
    supabaseAdmin
      .from("discovery_sessions")
      .select("id, business_name_draft, status, pack_version, created_at, updated_at, submitted_at, approved_at")
      .eq("tenant_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("organization_members")
      .select("user_id, role, status, created_at, invited_at, activated_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at"),
    supabaseAdmin
      .from("organization_sites")
      .select("organization_id, subdomain, status, source_session_id, provisioned_at, published_at")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabaseAdmin.from("gym_branches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabaseAdmin.from("gym_membership_plans").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("published", true),
    supabaseAdmin.from("gym_classes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("published", true),
    supabaseAdmin.from("gym_catalog_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("active", true).eq("published", true),
  ]);

  if (organizationResult.error) throw new Error(`No se pudo cargar el cliente: ${organizationResult.error.message}`);
  if (sessionsResult.error) throw new Error(`No se pudieron cargar sus onboardings: ${sessionsResult.error.message}`);
  if (membersResult.error) throw new Error(`No se pudieron cargar sus miembros: ${membersResult.error.message}`);
  if (siteResult.error) throw new Error(`No se pudo cargar la plataforma: ${siteResult.error.message}`);
  const platformError = [branchesResult, plansResult, classesResult, offeringsResult].find((result) => result.error)?.error;
  if (platformError) throw new Error(`No se pudo calcular la preparación de la plataforma: ${platformError.message}`);
  if (!organizationResult.data) return null;

  const members = await Promise.all(
    (membersResult.data ?? []).map(async (membership) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(membership.user_id);
      return { ...membership, email: data.user?.email ?? null };
    }),
  );
  const sourceSession = (sessionsResult.data ?? []).find((session) => session.status === "approved") ?? null;
  let previewPlanCount = 0;
  let previewClassCount = 0;
  if (!siteResult.data && sourceSession) {
    const { data: responses, error: responsesError } = await supabaseAdmin
      .from("discovery_responses")
      .select("question_id, status, value")
      .eq("session_id", sourceSession.id);
    if (responsesError) throw new Error(`No se pudo preparar la vista previa: ${responsesError.message}`);
    const preview = buildPlatformDraft(organizationResult.data.name, responses ?? []);
    previewPlanCount = preview.plans.length;
    previewClassCount = preview.classes.length;
  }

  const activeOwnerCount = members.filter((member) => member.role === "owner" && member.status === "active").length;
  const platform = siteResult.data ? {
    subdomain: siteResult.data.subdomain,
    status: siteResult.data.status as "draft" | "published" | "paused",
    provisionedAt: siteResult.data.provisioned_at,
    publishedAt: siteResult.data.published_at,
    readiness: [
      { key: "onboarding", label: "Onboarding aprobado", detail: "La plataforma conserva el origen de la configuración.", ready: Boolean(siteResult.data.source_session_id) },
      { key: "owner", label: "Propietario activo", detail: activeOwnerCount ? "El acceso del propietario está activo." : "El propietario debe aceptar su invitación.", ready: activeOwnerCount > 0 },
      { key: "branch", label: "Sucursal principal", detail: `${branchesResult.count ?? 0} sucursal activa.`, ready: (branchesResult.count ?? 0) > 0 },
      { key: "offering", label: "Oferta y cobro", detail: `${plansResult.count ?? 0} planes · ${offeringsResult.count ?? 0} conceptos publicados.`, ready: (offeringsResult.count ?? 0) > 0 },
      { key: "schedule", label: "Horario de clases", detail: `${classesResult.count ?? 0} clases listas para reservar.`, ready: (classesResult.count ?? 0) > 0 },
    ],
    canPublish: Boolean(
      siteResult.data.source_session_id
      && activeOwnerCount > 0
      && (branchesResult.count ?? 0) > 0
      && (offeringsResult.count ?? 0) > 0
      && (classesResult.count ?? 0) > 0
    ),
  } : null;

  return {
    organization: organizationResult.data,
    sessions: sessionsResult.data ?? [],
    members,
    sourceSessionId: sourceSession?.id ?? null,
    previewPlanCount,
    previewClassCount,
    platform,
  };
}
