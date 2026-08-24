import "server-only";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface GymSiteDTO {
  organizationId: string;
  subdomain: string;
  name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  primaryColor: string;
  accentColor: string;
}

export interface GymPlanDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  features: string[];
  published: boolean;
}

export interface GymClassDTO {
  id: string;
  slug: string;
  name: string;
  coach: string;
  weekdays: number[];
  startTime: string;
  durationMinutes: number;
  capacity: number;
  intensity: "base" | "medium" | "high";
  published: boolean;
}

export interface GymCustomerDTO {
  id: string;
  name: string;
  email: string;
  status: "lead" | "active" | "paused" | "cancelled";
  planId: string | null;
  planName: string | null;
  planPriceCents: number;
  joinedOn: string | null;
  nextPaymentOn: string | null;
}

export interface GymPublicPlatformDTO {
  site: GymSiteDTO;
  plans: GymPlanDTO[];
  classes: GymClassDTO[];
}

export interface GymManagementDTO extends GymPublicPlatformDTO {
  manager: { userId: string; email: string; role: "owner" | "admin" };
  customers: GymCustomerDTO[];
  metrics: { totalCustomers: number; activeCustomers: number; leads: number; monthlyRevenueCents: number };
}

export interface GymMemberDTO extends GymPublicPlatformDTO {
  member: GymCustomerDTO;
}

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeFeatures(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
}

function mapSite(site: Record<string, unknown>): GymSiteDTO {
  return {
    organizationId: String(site.organization_id),
    subdomain: String(site.subdomain),
    name: String(site.site_name),
    tagline: String(site.tagline),
    description: String(site.description),
    address: String(site.address),
    phone: String(site.phone),
    primaryColor: String(site.primary_color),
    accentColor: String(site.accent_color),
  };
}

function mapPlan(plan: Record<string, unknown>): GymPlanDTO {
  return {
    id: String(plan.id),
    slug: String(plan.slug),
    name: String(plan.name),
    description: String(plan.description),
    priceCents: Number(plan.price_cents),
    features: safeFeatures(plan.features),
    published: Boolean(plan.published),
  };
}

function mapClass(gymClass: Record<string, unknown>): GymClassDTO {
  return {
    id: String(gymClass.id),
    slug: String(gymClass.slug),
    name: String(gymClass.name),
    coach: String(gymClass.coach),
    weekdays: Array.isArray(gymClass.weekdays) ? gymClass.weekdays.map(Number) : [],
    startTime: String(gymClass.start_time).slice(0, 5),
    durationMinutes: Number(gymClass.duration_minutes),
    capacity: Number(gymClass.capacity),
    intensity: gymClass.intensity as GymClassDTO["intensity"],
    published: Boolean(gymClass.published),
  };
}

export const getPublicGymPlatform = cache(async (subdomain: string): Promise<GymPublicPlatformDTO | null> => {
  const supabase = publicClient();
  const { data: site, error: siteError } = await supabase
    .from("organization_sites")
    .select("organization_id, subdomain, site_name, tagline, description, address, phone, primary_color, accent_color")
    .eq("subdomain", subdomain)
    .eq("status", "published")
    .maybeSingle();
  if (siteError) throw new Error("No se pudo cargar el sitio.");
  if (!site) return null;

  const [plansResult, classesResult] = await Promise.all([
    supabase
      .from("gym_membership_plans")
      .select("id, slug, name, description, price_cents, features, published")
      .eq("organization_id", site.organization_id)
      .eq("published", true)
      .order("sort_order"),
    supabase
      .from("gym_classes")
      .select("id, slug, name, coach, weekdays, start_time, duration_minutes, capacity, intensity, published")
      .eq("organization_id", site.organization_id)
      .eq("published", true)
      .order("start_time"),
  ]);
  if (plansResult.error || classesResult.error) throw new Error("No se pudo cargar la oferta del gimnasio.");
  return {
    site: mapSite(site),
    plans: (plansResult.data ?? []).map(mapPlan),
    classes: (classesResult.data ?? []).map(mapClass),
  };
});

async function currentIdentity() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  return error || !userId || !email ? null : { userId, email, supabase };
}

export async function requireGymManager(subdomain: string) {
  const platform = await getPublicGymPlatform(subdomain);
  if (!platform) return null;
  const identity = await currentIdentity();
  if (!identity) redirect("/gestion/entrar");
  const { data: membership, error } = await identity.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", platform.site.organizationId)
    .eq("user_id", identity.userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (error || !membership) redirect("/gestion/entrar?error=access");
  return { ...identity, role: membership.role as "owner" | "admin", platform };
}

export async function getGymManagementData(subdomain: string): Promise<GymManagementDTO | null> {
  const access = await requireGymManager(subdomain);
  if (!access) return null;
  const { supabase, platform } = access;
  const [plansResult, classesResult, customersResult] = await Promise.all([
    supabase.from("gym_membership_plans").select("id, slug, name, description, price_cents, features, published").eq("organization_id", platform.site.organizationId).order("sort_order"),
    supabase.from("gym_classes").select("id, slug, name, coach, weekdays, start_time, duration_minutes, capacity, intensity, published").eq("organization_id", platform.site.organizationId).order("start_time"),
    supabase.from("gym_customers").select("id, name, email, status, plan_id, joined_on, next_payment_on").eq("organization_id", platform.site.organizationId).order("created_at"),
  ]);
  if (plansResult.error || classesResult.error || customersResult.error) throw new Error("No se pudo cargar la operación del gimnasio.");

  const plans = (plansResult.data ?? []).map(mapPlan);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const customers: GymCustomerDTO[] = (customersResult.data ?? []).map((customer) => {
    const plan = customer.plan_id ? planById.get(customer.plan_id) : null;
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      status: customer.status as GymCustomerDTO["status"],
      planId: customer.plan_id,
      planName: plan?.name ?? null,
      planPriceCents: plan?.priceCents ?? 0,
      joinedOn: customer.joined_on,
      nextPaymentOn: customer.next_payment_on,
    };
  });
  const active = customers.filter((customer) => customer.status === "active");
  return {
    site: platform.site,
    plans,
    classes: (classesResult.data ?? []).map(mapClass),
    customers,
    manager: { userId: access.userId, email: access.email, role: access.role },
    metrics: {
      totalCustomers: customers.length,
      activeCustomers: active.length,
      leads: customers.filter((customer) => customer.status === "lead").length,
      monthlyRevenueCents: active.reduce((sum, customer) => sum + customer.planPriceCents, 0),
    },
  };
}

export async function getGymMemberData(subdomain: string): Promise<GymMemberDTO | null> {
  const platform = await getPublicGymPlatform(subdomain);
  if (!platform) return null;
  const identity = await currentIdentity();
  if (!identity) redirect("/mi-cuenta/entrar");
  const { data: customer, error } = await identity.supabase
    .from("gym_customers")
    .select("id, name, email, status, plan_id, joined_on, next_payment_on")
    .eq("organization_id", platform.site.organizationId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (error || !customer) redirect("/mi-cuenta/entrar?error=access");
  const plan = platform.plans.find((item) => item.id === customer.plan_id) ?? null;
  return {
    ...platform,
    member: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      status: customer.status as GymCustomerDTO["status"],
      planId: customer.plan_id,
      planName: plan?.name ?? null,
      planPriceCents: plan?.priceCents ?? 0,
      joinedOn: customer.joined_on,
      nextPaymentOn: customer.next_payment_on,
    },
  };
}
