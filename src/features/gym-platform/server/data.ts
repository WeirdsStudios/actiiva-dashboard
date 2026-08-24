import "server-only";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { addDaysToISO, isUpcomingOccurrence, todayInMexico } from "@/features/gym-platform/lib/calendar";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type GymCustomerStatus = "lead" | "active" | "paused" | "cancelled";
export type GymReservationStatus = "reserved" | "waitlisted" | "cancelled" | "attended" | "no_show";
export type GymTimeWindow = "early" | "morning" | "midday" | "evening" | "night";

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
  scheduleInterestThreshold: number;
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

export interface GymClassOccurrenceDTO {
  key: string;
  classId: string;
  classDate: string;
  name: string;
  coach: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  reservedCount: number;
  waitlistCount: number;
  availableSpots: number;
  intensity: GymClassDTO["intensity"];
}

export interface GymCustomerDTO {
  id: string;
  name: string;
  email: string;
  status: GymCustomerStatus;
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
  occurrences: GymClassOccurrenceDTO[];
}

export interface GymMemberOccurrenceDTO extends GymClassOccurrenceDTO {
  reservationId: string | null;
  reservationStatus: GymReservationStatus | null;
}

export interface GymManagementReservationDTO {
  id: string;
  customerId: string;
  customerName: string;
  status: GymReservationStatus;
}

export interface GymManagementOccurrenceDTO extends GymClassOccurrenceDTO {
  reservations: GymManagementReservationDTO[];
}

export interface GymDemandDTO {
  key: string;
  classId: string;
  className: string;
  weekday: number;
  timeWindow: GymTimeWindow;
  requestCount: number;
  threshold: number;
  ready: boolean;
  requesterNames: string[];
}

export interface GymManagementDTO extends Omit<GymPublicPlatformDTO, "occurrences"> {
  manager: { userId: string; email: string; role: "owner" | "admin" };
  customers: GymCustomerDTO[];
  occurrences: GymManagementOccurrenceDTO[];
  demands: GymDemandDTO[];
  metrics: {
    totalCustomers: number;
    activeCustomers: number;
    leads: number;
    monthlyRevenueCents: number;
    occupancyPercent: number;
    waitlistedCount: number;
  };
}

export interface GymMemberDTO extends Omit<GymPublicPlatformDTO, "occurrences"> {
  member: GymCustomerDTO;
  occurrences: GymMemberOccurrenceDTO[];
  reservationSummary: { reserved: number; waitlisted: number };
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
    scheduleInterestThreshold: Number(site.schedule_interest_threshold),
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

function mapOccurrence(availability: Record<string, unknown>, gymClass: GymClassDTO): GymClassOccurrenceDTO {
  const capacity = Number(availability.capacity);
  const reservedCount = Number(availability.reserved_count);
  const classDate = String(availability.class_date);
  return {
    key: `${gymClass.id}:${classDate}`,
    classId: gymClass.id,
    classDate,
    name: gymClass.name,
    coach: gymClass.coach,
    startTime: gymClass.startTime,
    durationMinutes: gymClass.durationMinutes,
    capacity,
    reservedCount,
    waitlistCount: Number(availability.waitlist_count),
    availableSpots: Math.max(capacity - reservedCount, 0),
    intensity: gymClass.intensity,
  };
}

function mapCustomer(customer: Record<string, unknown>, planById: Map<string, GymPlanDTO>): GymCustomerDTO {
  const planId = customer.plan_id ? String(customer.plan_id) : null;
  const plan = planId ? planById.get(planId) : null;
  return {
    id: String(customer.id),
    name: String(customer.name),
    email: String(customer.email),
    status: customer.status as GymCustomerStatus,
    planId,
    planName: plan?.name ?? null,
    planPriceCents: plan?.priceCents ?? 0,
    joinedOn: customer.joined_on ? String(customer.joined_on) : null,
    nextPaymentOn: customer.next_payment_on ? String(customer.next_payment_on) : null,
  };
}

export const getPublicGymPlatform = cache(async (subdomain: string): Promise<GymPublicPlatformDTO | null> => {
  const supabase = publicClient();
  const { data: site, error: siteError } = await supabase
    .from("organization_sites")
    .select("organization_id, subdomain, site_name, tagline, description, address, phone, primary_color, accent_color, schedule_interest_threshold")
    .eq("subdomain", subdomain)
    .eq("status", "published")
    .maybeSingle();
  if (siteError) throw new Error("No se pudo cargar el sitio.");
  if (!site) return null;

  const fromDate = todayInMexico();
  const toDate = addDaysToISO(fromDate, 9);
  const [plansResult, classesResult, availabilityResult] = await Promise.all([
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
    supabase.rpc("get_gym_class_availability", {
      p_organization_id: site.organization_id,
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  ]);
  if (plansResult.error || classesResult.error || availabilityResult.error) throw new Error("No se pudo cargar la oferta del gimnasio.");
  const classes = (classesResult.data ?? []).map(mapClass);
  const classById = new Map(classes.map((gymClass) => [gymClass.id, gymClass]));
  const occurrences = (availabilityResult.data ?? []).flatMap((availability: Record<string, unknown>) => {
    const gymClass = classById.get(String(availability.class_id));
    const classDate = String(availability.class_date);
    return gymClass && isUpcomingOccurrence(classDate, gymClass.startTime) ? [mapOccurrence(availability, gymClass)] : [];
  });
  return {
    site: mapSite(site),
    plans: (plansResult.data ?? []).map(mapPlan),
    classes,
    occurrences,
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
  const [platform, identity] = await Promise.all([getPublicGymPlatform(subdomain), currentIdentity()]);
  if (!platform) return null;
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

export async function requireGymMember(subdomain: string) {
  const [platform, identity] = await Promise.all([getPublicGymPlatform(subdomain), currentIdentity()]);
  if (!platform) return null;
  if (!identity) redirect("/mi-cuenta/entrar");
  const { data: customer, error } = await identity.supabase
    .from("gym_customers")
    .select("id, name, email, status, plan_id, joined_on, next_payment_on")
    .eq("organization_id", platform.site.organizationId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (error || !customer) redirect("/mi-cuenta/entrar?error=access");
  return { ...identity, customer, platform };
}

export async function getGymManagementData(subdomain: string): Promise<GymManagementDTO | null> {
  const access = await requireGymManager(subdomain);
  if (!access) return null;
  const { supabase, platform } = access;
  const fromDate = todayInMexico();
  const toDate = addDaysToISO(fromDate, 9);
  const [plansResult, classesResult, customersResult, reservationsResult, demandResult] = await Promise.all([
    supabase.from("gym_membership_plans").select("id, slug, name, description, price_cents, features, published").eq("organization_id", platform.site.organizationId).order("sort_order"),
    supabase.from("gym_classes").select("id, slug, name, coach, weekdays, start_time, duration_minutes, capacity, intensity, published").eq("organization_id", platform.site.organizationId).order("start_time"),
    supabase.from("gym_customers").select("id, name, email, status, plan_id, joined_on, next_payment_on").eq("organization_id", platform.site.organizationId).order("created_at"),
    supabase.from("gym_class_reservations").select("id, class_id, customer_id, class_date, status").eq("organization_id", platform.site.organizationId).gte("class_date", fromDate).lte("class_date", toDate).in("status", ["reserved", "waitlisted"]),
    supabase.from("gym_schedule_requests").select("id, class_id, customer_id, preferred_weekday, preferred_time_window, status").eq("organization_id", platform.site.organizationId).eq("status", "open"),
  ]);
  if (plansResult.error || classesResult.error || customersResult.error || reservationsResult.error || demandResult.error) {
    throw new Error("No se pudo cargar la operación del gimnasio.");
  }

  const plans = (plansResult.data ?? []).map(mapPlan);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const customers = (customersResult.data ?? []).map((customer) => mapCustomer(customer, planById));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const classes = (classesResult.data ?? []).map(mapClass);
  const classById = new Map(classes.map((gymClass) => [gymClass.id, gymClass]));
  const reservationByOccurrence = new Map<string, GymManagementReservationDTO[]>();
  for (const reservation of reservationsResult.data ?? []) {
    const key = `${reservation.class_id}:${reservation.class_date}`;
    const customer = customerById.get(String(reservation.customer_id));
    if (!customer) continue;
    const current = reservationByOccurrence.get(key) ?? [];
    current.push({
      id: String(reservation.id),
      customerId: customer.id,
      customerName: customer.name,
      status: reservation.status as GymReservationStatus,
    });
    reservationByOccurrence.set(key, current);
  }
  const occurrences: GymManagementOccurrenceDTO[] = platform.occurrences.map((occurrence) => ({
    ...occurrence,
    reservations: reservationByOccurrence.get(occurrence.key) ?? [],
  }));

  const groupedDemand = new Map<string, GymDemandDTO>();
  for (const request of demandResult.data ?? []) {
    const gymClass = classById.get(String(request.class_id));
    const customer = customerById.get(String(request.customer_id));
    if (!gymClass || !customer) continue;
    const key = `${gymClass.id}:${request.preferred_weekday}:${request.preferred_time_window}`;
    const current = groupedDemand.get(key) ?? {
      key,
      classId: gymClass.id,
      className: gymClass.name,
      weekday: Number(request.preferred_weekday),
      timeWindow: request.preferred_time_window as GymTimeWindow,
      requestCount: 0,
      threshold: platform.site.scheduleInterestThreshold,
      ready: false,
      requesterNames: [],
    };
    current.requestCount += 1;
    current.ready = current.requestCount >= current.threshold;
    current.requesterNames.push(customer.name);
    groupedDemand.set(key, current);
  }

  const active = customers.filter((customer) => customer.status === "active");
  const totalCapacity = occurrences.reduce((sum, occurrence) => sum + occurrence.capacity, 0);
  const totalReserved = occurrences.reduce((sum, occurrence) => sum + occurrence.reservedCount, 0);
  return {
    site: platform.site,
    plans,
    classes,
    occurrences,
    demands: [...groupedDemand.values()].sort((a, b) => b.requestCount - a.requestCount),
    customers,
    manager: { userId: access.userId, email: access.email, role: access.role },
    metrics: {
      totalCustomers: customers.length,
      activeCustomers: active.length,
      leads: customers.filter((customer) => customer.status === "lead").length,
      monthlyRevenueCents: active.reduce((sum, customer) => sum + customer.planPriceCents, 0),
      occupancyPercent: totalCapacity ? Math.round((totalReserved / totalCapacity) * 100) : 0,
      waitlistedCount: occurrences.reduce((sum, occurrence) => sum + occurrence.waitlistCount, 0),
    },
  };
}

export async function getGymMemberData(subdomain: string): Promise<GymMemberDTO | null> {
  const access = await requireGymMember(subdomain);
  if (!access) return null;
  const { customer, platform, supabase } = access;
  const fromDate = todayInMexico();
  const toDate = addDaysToISO(fromDate, 9);
  const { data: reservations, error } = await supabase
    .from("gym_class_reservations")
    .select("id, class_id, class_date, status")
    .eq("customer_id", customer.id)
    .gte("class_date", fromDate)
    .lte("class_date", toDate)
    .in("status", ["reserved", "waitlisted"]);
  if (error) throw new Error("No se pudieron cargar tus reservas.");
  const reservationByOccurrence = new Map(
    (reservations ?? []).map((reservation) => [`${reservation.class_id}:${reservation.class_date}`, reservation]),
  );
  const occurrences: GymMemberOccurrenceDTO[] = platform.occurrences.map((occurrence) => {
    const reservation = reservationByOccurrence.get(occurrence.key);
    return {
      ...occurrence,
      reservationId: reservation ? String(reservation.id) : null,
      reservationStatus: reservation ? reservation.status as GymReservationStatus : null,
    };
  });
  const planById = new Map(platform.plans.map((plan) => [plan.id, plan]));
  return {
    site: platform.site,
    plans: platform.plans,
    classes: platform.classes,
    occurrences,
    member: mapCustomer(customer, planById),
    reservationSummary: {
      reserved: occurrences.filter((occurrence) => occurrence.reservationStatus === "reserved").length,
      waitlisted: occurrences.filter((occurrence) => occurrence.reservationStatus === "waitlisted").length,
    },
  };
}
