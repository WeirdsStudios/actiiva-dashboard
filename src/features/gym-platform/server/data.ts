import "server-only";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { addDaysToISO, isUpcomingOccurrence, todayInMexico } from "@/features/gym-platform/lib/calendar";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type GymCustomerStatus = "lead" | "active" | "paused" | "cancelled";
export type GymReservationStatus = "reserved" | "waitlisted" | "cancelled" | "attended" | "no_show";
export type GymTimeWindow = "early" | "morning" | "midday" | "evening" | "night";
export type GymPaymentMethod = "cash" | "card" | "bank_transfer" | "mercado_pago";
export type GymMembershipStatus = "pending" | "active" | "paused" | "expired" | "cancelled";

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
  demandHoldHours: number;
  timezone: string;
  currency: string;
}

export interface GymPlanDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  features: string[];
  published: boolean;
  durationCount: number;
  durationUnit: "day" | "week" | "month" | "year";
  classAccess: "none" | "unlimited" | "credits";
  classCredits: number | null;
  graceDays: number;
  enrollmentFeeCents: number;
  autoRenewAvailable: boolean;
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
  phone: string;
  status: GymCustomerStatus;
  planId: string | null;
  planName: string | null;
  planPriceCents: number;
  joinedOn: string | null;
  nextPaymentOn: string | null;
  membership: GymMembershipDTO | null;
  upcomingMembership: GymMembershipDTO | null;
}

export interface GymMembershipDTO {
  id: string;
  planId: string;
  planName: string;
  status: GymMembershipStatus;
  startsOn: string;
  endsOn: string;
  graceEndsOn: string;
  priceCents: number;
  creditsTotal: number | null;
  creditsUsed: number;
  creditsRemaining: number | null;
  autoRenew: boolean;
  daysRemaining: number;
}

export interface GymBranchDTO {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
}

export interface GymCatalogItemDTO {
  id: string;
  membershipPlanId: string | null;
  name: string;
  sku: string | null;
  itemType: "membership" | "service" | "product" | "class_pack" | "drop_in";
  priceCents: number;
  costCents: number;
  tracksInventory: boolean;
  active: boolean;
  inventoryQuantity: number | null;
  reorderPoint: number | null;
}

export interface GymPaymentDTO {
  id: string;
  customerId: string | null;
  customerName: string | null;
  orderId: string;
  orderNumber: number;
  method: GymPaymentMethod;
  amountCents: number;
  paidAt: string;
  reference: string | null;
  receiptToken: string | null;
}

export interface GymCashSessionDTO {
  id: string;
  branchId: string;
  status: "open" | "closed";
  openingAmountCents: number;
  expectedAmountCents: number | null;
  closingAmountCents: number | null;
  openedAt: string;
}

export interface GymConnectionDTO {
  provider: "mercado_pago" | "whatsapp";
  status: "disconnected" | "pending" | "connected" | "error";
  displayName: string | null;
}

export interface GymClassHoldDTO {
  id: string;
  token: string;
  className: string;
  startsAt: string;
  priceCents: number;
  status: "pending" | "confirmed" | "expired" | "cancelled";
  expiresAt: string;
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
  branches: GymBranchDTO[];
  catalog: GymCatalogItemDTO[];
  payments: GymPaymentDTO[];
  cashSessions: GymCashSessionDTO[];
  connections: GymConnectionDTO[];
  metrics: {
    totalCustomers: number;
    activeCustomers: number;
    leads: number;
    monthlyRevenueCents: number;
    occupancyPercent: number;
    waitlistedCount: number;
    collectedThisMonthCents: number;
    salesThisMonth: number;
    lowStockItems: number;
    whatsappDrafts: number;
  };
}

export interface GymMemberDTO extends Omit<GymPublicPlatformDTO, "occurrences"> {
  member: GymCustomerDTO;
  occurrences: GymMemberOccurrenceDTO[];
  reservationSummary: { reserved: number; waitlisted: number };
  memberships: GymMembershipDTO[];
  payments: GymPaymentDTO[];
  holds: GymClassHoldDTO[];
}

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SITE_SELECT = "organization_id, subdomain, site_name, tagline, description, address, phone, primary_color, accent_color, schedule_interest_threshold, demand_hold_hours, timezone, currency";
const PLAN_SELECT = "id, slug, name, description, price_cents, features, published, duration_count, duration_unit, class_access, class_credits, grace_days, enrollment_fee_cents, auto_renew_available";
const MEMBERSHIP_SELECT = "id, customer_id, plan_id, status, starts_on, ends_on, grace_ends_on, price_cents, class_credits_total, class_credits_used, auto_renew";

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
    demandHoldHours: Number(site.demand_hold_hours),
    timezone: String(site.timezone),
    currency: String(site.currency),
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
    durationCount: Number(plan.duration_count),
    durationUnit: plan.duration_unit as GymPlanDTO["durationUnit"],
    classAccess: plan.class_access as GymPlanDTO["classAccess"],
    classCredits: plan.class_credits === null ? null : Number(plan.class_credits),
    graceDays: Number(plan.grace_days),
    enrollmentFeeCents: Number(plan.enrollment_fee_cents),
    autoRenewAvailable: Boolean(plan.auto_renew_available),
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
    phone: String(customer.phone ?? ""),
    status: customer.status as GymCustomerStatus,
    planId,
    planName: plan?.name ?? null,
    planPriceCents: plan?.priceCents ?? 0,
    joinedOn: customer.joined_on ? String(customer.joined_on) : null,
    nextPaymentOn: customer.next_payment_on ? String(customer.next_payment_on) : null,
    membership: null,
    upcomingMembership: null,
  };
}

function dateDistance(from: string, to: string): number {
  return Math.max(Math.ceil((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000), 0);
}

function mapMembership(membership: Record<string, unknown>, planById: Map<string, GymPlanDTO>, today: string): GymMembershipDTO {
  const planId = String(membership.plan_id);
  const creditsTotal = membership.class_credits_total === null ? null : Number(membership.class_credits_total);
  const creditsUsed = Number(membership.class_credits_used);
  return {
    id: String(membership.id),
    planId,
    planName: planById.get(planId)?.name ?? "Plan anterior",
    status: membership.status as GymMembershipStatus,
    startsOn: String(membership.starts_on),
    endsOn: String(membership.ends_on),
    graceEndsOn: String(membership.grace_ends_on),
    priceCents: Number(membership.price_cents),
    creditsTotal,
    creditsUsed,
    creditsRemaining: creditsTotal === null ? null : Math.max(creditsTotal - creditsUsed, 0),
    autoRenew: Boolean(membership.auto_renew),
    daysRemaining: dateDistance(today, String(membership.ends_on)),
  };
}

export const getPublicGymPlatform = cache(async (subdomain: string): Promise<GymPublicPlatformDTO | null> => {
  const supabase = publicClient();
  const { data: site, error: siteError } = await supabase
    .from("organization_sites")
    .select(SITE_SELECT)
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
      .select(PLAN_SELECT)
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
    .select("id, name, email, phone, status, plan_id, joined_on, next_payment_on")
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
  const monthStart = `${fromDate.slice(0, 7)}-01T00:00:00-06:00`;
  const [
    plansResult, classesResult, customersResult, reservationsResult, demandResult,
    membershipsResult, branchesResult, catalogResult, inventoryResult,
    ordersResult, paymentsResult, receiptsResult, cashResult, connectionsResult, notificationsResult,
  ] = await Promise.all([
    supabase.from("gym_membership_plans").select(PLAN_SELECT).eq("organization_id", platform.site.organizationId).order("sort_order"),
    supabase.from("gym_classes").select("id, slug, name, coach, weekdays, start_time, duration_minutes, capacity, intensity, published").eq("organization_id", platform.site.organizationId).order("start_time"),
    supabase.from("gym_customers").select("id, name, email, phone, status, plan_id, joined_on, next_payment_on").eq("organization_id", platform.site.organizationId).order("created_at"),
    supabase.from("gym_class_reservations").select("id, class_id, customer_id, class_date, status").eq("organization_id", platform.site.organizationId).gte("class_date", fromDate).lte("class_date", toDate).in("status", ["reserved", "waitlisted"]),
    supabase.from("gym_schedule_requests").select("id, class_id, customer_id, preferred_weekday, preferred_time_window, status").eq("organization_id", platform.site.organizationId).eq("status", "open"),
    supabase.from("gym_customer_memberships").select(MEMBERSHIP_SELECT).eq("organization_id", platform.site.organizationId).order("starts_on", { ascending: false }),
    supabase.from("gym_branches").select("id, name, address, is_primary").eq("organization_id", platform.site.organizationId).eq("status", "active").order("is_primary", { ascending: false }),
    supabase.from("gym_catalog_items").select("id, membership_plan_id, name, sku, item_type, price_cents, cost_cents, tracks_inventory, active").eq("organization_id", platform.site.organizationId).eq("active", true).order("item_type").order("name"),
    supabase.from("gym_inventory_levels").select("branch_id, catalog_item_id, quantity, reorder_point").eq("organization_id", platform.site.organizationId),
    supabase.from("gym_orders").select("id, order_number, customer_id, total_cents, status, paid_at").eq("organization_id", platform.site.organizationId).eq("status", "paid").order("paid_at", { ascending: false }).limit(80),
    supabase.from("gym_payments").select("id, order_id, customer_id, payment_method, amount_cents, reference, paid_at").eq("organization_id", platform.site.organizationId).eq("status", "approved").gte("paid_at", monthStart).order("paid_at", { ascending: false }).limit(80),
    supabase.from("gym_receipts").select("order_id, public_token").eq("organization_id", platform.site.organizationId),
    supabase.from("gym_cash_sessions").select("id, branch_id, status, opening_amount_cents, expected_amount_cents, closing_amount_cents, opened_at").eq("organization_id", platform.site.organizationId).eq("status", "open"),
    supabase.from("gym_provider_connections").select("provider, status, display_name").eq("organization_id", platform.site.organizationId),
    supabase.from("gym_notification_outbox").select("id", { count: "exact", head: true }).eq("organization_id", platform.site.organizationId).eq("channel", "whatsapp").eq("status", "draft"),
  ]);
  const operationError = [
    plansResult, classesResult, customersResult, reservationsResult, demandResult,
    membershipsResult, branchesResult, catalogResult, inventoryResult, ordersResult,
    paymentsResult, receiptsResult, cashResult, connectionsResult, notificationsResult,
  ].find((result) => result.error)?.error;
  if (operationError) {
    throw new Error("No se pudo cargar la operación del gimnasio.");
  }

  const plans = (plansResult.data ?? []).map(mapPlan);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const membershipsByCustomer = new Map<string, GymMembershipDTO[]>();
  for (const row of membershipsResult.data ?? []) {
    const membership = mapMembership(row, planById, fromDate);
    const current = membershipsByCustomer.get(String(row.customer_id)) ?? [];
    current.push(membership);
    membershipsByCustomer.set(String(row.customer_id), current);
  }
  const customers = (customersResult.data ?? []).map((customer) => {
    const mapped = mapCustomer(customer, planById);
    const memberships = membershipsByCustomer.get(mapped.id) ?? [];
    const membership = memberships.find((item) => item.status === "active" || item.status === "paused") ?? null;
    const upcomingMembership = memberships
      .filter((item) => item.status === "pending")
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
    return {
      ...mapped,
      planId: membership?.planId ?? mapped.planId,
      planName: membership?.planName ?? mapped.planName,
      planPriceCents: membership?.priceCents ?? mapped.planPriceCents,
      nextPaymentOn: membership ? addDaysToISO(membership.endsOn, 1) : mapped.nextPaymentOn,
      membership,
      upcomingMembership,
    };
  });
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
  const branches: GymBranchDTO[] = (branchesResult.data ?? []).map((branch) => ({
    id: String(branch.id), name: String(branch.name), address: String(branch.address), isPrimary: Boolean(branch.is_primary),
  }));
  const primaryBranchId = branches.find((branch) => branch.isPrimary)?.id ?? branches[0]?.id;
  const inventoryByItem = new Map(
    (inventoryResult.data ?? [])
      .filter((row) => !primaryBranchId || row.branch_id === primaryBranchId)
      .map((row) => [String(row.catalog_item_id), row]),
  );
  const catalog: GymCatalogItemDTO[] = (catalogResult.data ?? []).map((item) => {
    const inventory = inventoryByItem.get(String(item.id));
    return {
      id: String(item.id),
      membershipPlanId: item.membership_plan_id ? String(item.membership_plan_id) : null,
      name: String(item.name),
      sku: item.sku ? String(item.sku) : null,
      itemType: item.item_type as GymCatalogItemDTO["itemType"],
      priceCents: Number(item.price_cents),
      costCents: Number(item.cost_cents),
      tracksInventory: Boolean(item.tracks_inventory),
      active: Boolean(item.active),
      inventoryQuantity: inventory ? Number(inventory.quantity) : null,
      reorderPoint: inventory ? Number(inventory.reorder_point) : null,
    };
  });
  const orderById = new Map((ordersResult.data ?? []).map((order) => [String(order.id), order]));
  const receiptByOrder = new Map((receiptsResult.data ?? []).map((receipt) => [String(receipt.order_id), String(receipt.public_token)]));
  const payments: GymPaymentDTO[] = (paymentsResult.data ?? []).flatMap((payment) => {
    const order = orderById.get(String(payment.order_id));
    if (!order || !payment.paid_at) return [];
    const customer = payment.customer_id ? customerById.get(String(payment.customer_id)) : null;
    return [{
      id: String(payment.id),
      customerId: payment.customer_id ? String(payment.customer_id) : null,
      customerName: customer?.name ?? null,
      orderId: String(payment.order_id),
      orderNumber: Number(order.order_number),
      method: payment.payment_method as GymPaymentMethod,
      amountCents: Number(payment.amount_cents),
      paidAt: String(payment.paid_at),
      reference: payment.reference ? String(payment.reference) : null,
      receiptToken: receiptByOrder.get(String(payment.order_id)) ?? null,
    }];
  });
  const cashSessions: GymCashSessionDTO[] = (cashResult.data ?? []).map((cashSession) => ({
    id: String(cashSession.id),
    branchId: String(cashSession.branch_id),
    status: cashSession.status as "open" | "closed",
    openingAmountCents: Number(cashSession.opening_amount_cents),
    expectedAmountCents: cashSession.expected_amount_cents === null ? null : Number(cashSession.expected_amount_cents),
    closingAmountCents: cashSession.closing_amount_cents === null ? null : Number(cashSession.closing_amount_cents),
    openedAt: String(cashSession.opened_at),
  }));
  const connections: GymConnectionDTO[] = (connectionsResult.data ?? []).map((connection) => ({
    provider: connection.provider as GymConnectionDTO["provider"],
    status: connection.status as GymConnectionDTO["status"],
    displayName: connection.display_name ? String(connection.display_name) : null,
  }));
  const collectedThisMonthCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const lowStockItems = catalog.filter((item) => item.tracksInventory
    && item.inventoryQuantity !== null && item.reorderPoint !== null
    && item.inventoryQuantity <= item.reorderPoint).length;
  return {
    site: platform.site,
    plans,
    classes,
    occurrences,
    demands: [...groupedDemand.values()].sort((a, b) => b.requestCount - a.requestCount),
    branches,
    catalog,
    payments,
    cashSessions,
    connections,
    customers,
    manager: { userId: access.userId, email: access.email, role: access.role },
    metrics: {
      totalCustomers: customers.length,
      activeCustomers: active.length,
      leads: customers.filter((customer) => customer.status === "lead").length,
      monthlyRevenueCents: collectedThisMonthCents,
      occupancyPercent: totalCapacity ? Math.round((totalReserved / totalCapacity) * 100) : 0,
      waitlistedCount: occurrences.reduce((sum, occurrence) => sum + occurrence.waitlistCount, 0),
      collectedThisMonthCents,
      salesThisMonth: new Set(payments.map((payment) => payment.orderId)).size,
      lowStockItems,
      whatsappDrafts: notificationsResult.count ?? 0,
    },
  };
}

export async function getGymMemberData(subdomain: string): Promise<GymMemberDTO | null> {
  const access = await requireGymMember(subdomain);
  if (!access) return null;
  const { customer, platform, supabase } = access;
  const fromDate = todayInMexico();
  const toDate = addDaysToISO(fromDate, 9);
  const [reservationsResult, membershipsResult, ordersResult, paymentsResult, receiptsResult, holdsResult, extraOccurrencesResult] = await Promise.all([
    supabase.from("gym_class_reservations").select("id, class_id, class_date, status").eq("customer_id", customer.id).gte("class_date", fromDate).lte("class_date", toDate).in("status", ["reserved", "waitlisted"]),
    supabase.from("gym_customer_memberships").select(MEMBERSHIP_SELECT).eq("customer_id", customer.id).order("starts_on", { ascending: false }),
    supabase.from("gym_orders").select("id, order_number, customer_id, status, paid_at").eq("customer_id", customer.id).eq("status", "paid").order("paid_at", { ascending: false }).limit(24),
    supabase.from("gym_payments").select("id, order_id, customer_id, payment_method, amount_cents, reference, paid_at").eq("customer_id", customer.id).eq("status", "approved").order("paid_at", { ascending: false }).limit(24),
    supabase.from("gym_receipts").select("order_id, public_token").eq("customer_id", customer.id),
    supabase.from("gym_class_holds").select("id, occurrence_id, public_token, status, expires_at").eq("customer_id", customer.id).in("status", ["pending", "confirmed"]).order("created_at", { ascending: false }),
    supabase.from("gym_extra_class_occurrences").select("id, class_id, starts_at, price_cents, status").eq("organization_id", platform.site.organizationId).gte("starts_at", new Date().toISOString()).in("status", ["authorized", "confirmed"]),
  ]);
  if ([reservationsResult, membershipsResult, ordersResult, paymentsResult, receiptsResult, holdsResult, extraOccurrencesResult].some((result) => result.error)) {
    throw new Error("No se pudo cargar tu cuenta.");
  }
  const reservations = reservationsResult.data ?? [];
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
  const memberships = (membershipsResult.data ?? []).map((membership) => mapMembership(membership, planById, fromDate));
  const currentMembership = memberships.find((membership) => membership.status === "active" || membership.status === "paused") ?? null;
  const upcomingMembership = memberships
    .filter((membership) => membership.status === "pending")
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
  const mappedMember = mapCustomer(customer, planById);
  const orderById = new Map((ordersResult.data ?? []).map((order) => [String(order.id), order]));
  const receiptByOrder = new Map((receiptsResult.data ?? []).map((receipt) => [String(receipt.order_id), String(receipt.public_token)]));
  const payments: GymPaymentDTO[] = (paymentsResult.data ?? []).flatMap((payment) => {
    const order = orderById.get(String(payment.order_id));
    if (!order || !payment.paid_at) return [];
    return [{
      id: String(payment.id), customerId: String(customer.id), customerName: String(customer.name),
      orderId: String(payment.order_id), orderNumber: Number(order.order_number),
      method: payment.payment_method as GymPaymentMethod, amountCents: Number(payment.amount_cents),
      paidAt: String(payment.paid_at), reference: payment.reference ? String(payment.reference) : null,
      receiptToken: receiptByOrder.get(String(payment.order_id)) ?? null,
    }];
  });
  const classNameById = new Map(platform.classes.map((gymClass) => [gymClass.id, gymClass.name]));
  const extraById = new Map((extraOccurrencesResult.data ?? []).map((occurrence) => [String(occurrence.id), occurrence]));
  const holds: GymClassHoldDTO[] = (holdsResult.data ?? []).flatMap((hold) => {
    const occurrence = extraById.get(String(hold.occurrence_id));
    if (!occurrence) return [];
    return [{
      id: String(hold.id), token: String(hold.public_token),
      className: classNameById.get(String(occurrence.class_id)) ?? "Clase adicional",
      startsAt: String(occurrence.starts_at), priceCents: Number(occurrence.price_cents),
      status: hold.status as GymClassHoldDTO["status"], expiresAt: String(hold.expires_at),
    }];
  });
  return {
    site: platform.site,
    plans: platform.plans,
    classes: platform.classes,
    occurrences,
    member: {
      ...mappedMember,
      planId: currentMembership?.planId ?? mappedMember.planId,
      planName: currentMembership?.planName ?? mappedMember.planName,
      planPriceCents: currentMembership?.priceCents ?? mappedMember.planPriceCents,
      nextPaymentOn: currentMembership ? addDaysToISO(currentMembership.endsOn, 1) : mappedMember.nextPaymentOn,
      membership: currentMembership,
      upcomingMembership,
    },
    memberships,
    payments,
    holds,
    reservationSummary: {
      reserved: occurrences.filter((occurrence) => occurrence.reservationStatus === "reserved").length,
      waitlisted: occurrences.filter((occurrence) => occurrence.reservationStatus === "waitlisted").length,
    },
  };
}
