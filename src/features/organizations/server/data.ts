import "server-only";

import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

  const [{ data: sessions, error: sessionError }, { data: members, error: memberError }] = await Promise.all([
    supabaseAdmin
      .from("discovery_sessions")
      .select("tenant_id, status, updated_at")
      .in("tenant_id", organizationIds)
      .order("updated_at", { ascending: false }),
    supabaseAdmin.from("organization_members").select("organization_id").in("organization_id", organizationIds),
  ]);
  if (sessionError) throw new Error(`No se pudieron cargar los onboardings de clientes: ${sessionError.message}`);
  if (memberError) throw new Error(`No se pudieron cargar los miembros: ${memberError.message}`);

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
    };
  });
}

export async function getAdminOrganization(organizationId: string) {
  await requireAdmin();

  const [organizationResult, sessionsResult, membersResult] = await Promise.all([
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
      .select("user_id, role, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at"),
  ]);

  if (organizationResult.error) throw new Error(`No se pudo cargar el cliente: ${organizationResult.error.message}`);
  if (sessionsResult.error) throw new Error(`No se pudieron cargar sus onboardings: ${sessionsResult.error.message}`);
  if (membersResult.error) throw new Error(`No se pudieron cargar sus miembros: ${membersResult.error.message}`);
  if (!organizationResult.data) return null;

  const members = await Promise.all(
    (membersResult.data ?? []).map(async (membership) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(membership.user_id);
      return { ...membership, email: data.user?.email ?? null };
    }),
  );

  return {
    organization: organizationResult.data,
    sessions: sessionsResult.data ?? [],
    members,
  };
}
