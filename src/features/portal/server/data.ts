import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { OrganizationRole } from "@/features/organizations/lib/member-access";

export interface PortalIdentity { userId: string; email: string }
export interface PortalOrganization {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  role: OrganizationRole;
  memberSince: string;
  platform: { subdomain: string; status: "draft" | "published" | "paused" } | null;
}

export const getPortalIdentity = cache(async (): Promise<PortalIdentity | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (error || !userId || !email) return null;
  return { userId, email };
});

export async function requirePortalIdentity(): Promise<PortalIdentity> {
  const identity = await getPortalIdentity();
  if (!identity) redirect("/portal/login");
  return identity;
}

export const listPortalOrganizations = cache(async (): Promise<PortalOrganization[]> => {
  const identity = await requirePortalIdentity();
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, created_at")
    .eq("user_id", identity.userId)
    .eq("status", "active");
  if (membershipError) throw new Error("No se pudieron cargar tus accesos.");
  if (!memberships?.length) return [];

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const [{ data: organizations, error: organizationError }, { data: sites, error: siteError }] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status").in("id", organizationIds),
    supabase.from("organization_sites").select("organization_id, subdomain, status").in("organization_id", organizationIds),
  ]);
  if (organizationError) throw new Error("No se pudieron cargar tus cuentas.");
  if (siteError) throw new Error("No se pudieron cargar tus plataformas.");

  const byId = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  const siteByOrganization = new Map((sites ?? []).map((site) => [site.organization_id, site]));
  return memberships.flatMap((membership) => {
    const organization = byId.get(membership.organization_id);
    if (!organization) return [];
    return [{
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status as PortalOrganization["status"],
      role: membership.role as OrganizationRole,
      memberSince: membership.created_at,
      platform: siteByOrganization.has(organization.id) ? {
        subdomain: String(siteByOrganization.get(organization.id)?.subdomain),
        status: siteByOrganization.get(organization.id)?.status as "draft" | "published" | "paused",
      } : null,
    }];
  });
});

export async function getPortalOrganization(slug: string): Promise<PortalOrganization | null> {
  const organizations = await listPortalOrganizations();
  return organizations.find((organization) => organization.slug === slug) ?? null;
}
