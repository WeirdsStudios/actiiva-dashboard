import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addDaysToISO, todayInMexico } from "../src/features/gym-platform/lib/calendar";
import { supabaseAdmin } from "../src/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = `Aa1!${randomUUID()}z`;
const runId = randomUUID().replaceAll("-", "");
const createdUsers: string[] = [];
let tempCustomerId: string | null = null;
let tempOrderId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createUser(label: string) {
  const email = `actgym-${label}-${runId}@example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error(`No se creó ${label}`);
  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email: string) {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const { data: organization, error: organizationError } = await supabaseAdmin
  .from("organizations")
  .select("id, created_by")
  .eq("slug", "actgym")
  .single();
if (organizationError || !organization?.created_by) throw organizationError ?? new Error("ACTGym no existe");

const { count: baselineCustomerCount, error: baselineCustomerError } = await supabaseAdmin
  .from("gym_customers")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", organization.id);
if (baselineCustomerError || baselineCustomerCount === null) throw baselineCustomerError ?? new Error("No se contó el roster base");

try {
  const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const verificationStart = todayInMexico();
  const [{ data: publicSites }, { data: publicPlans }, { data: publicClasses }, { data: availability, error: availabilityError }, { error: publicCustomersError }] = await Promise.all([
    publicClient.from("organization_sites").select("subdomain").eq("subdomain", "mexgym"),
    publicClient.from("gym_membership_plans").select("id").eq("organization_id", organization.id),
    publicClient.from("gym_classes").select("id").eq("organization_id", organization.id),
    publicClient.rpc("get_gym_class_availability", { p_organization_id: organization.id, p_from_date: verificationStart, p_to_date: addDaysToISO(verificationStart, 9) }),
    publicClient.from("gym_customers").select("id"),
  ]);
  assert(publicSites?.length === 1, "El sitio publicado no es visible.");
  assert(publicPlans?.length === 3 && publicClasses?.length === 4, "La oferta pública está incompleta.");
  assert(!availabilityError && Boolean(availability?.length), "La disponibilidad agregada no está disponible.");
  assert(Boolean(publicCustomersError), "Anon pudo consultar socios privados.");

  const manager = await createUser("manager");
  const member = await createUser("member");
  const outsider = await createUser("outsider");
  const { error: managerMembershipError } = await supabaseAdmin.rpc("set_organization_member_access", {
    p_organization_id: organization.id,
    p_user_id: manager.id,
    p_role: "admin",
    p_status: "active",
    p_added_by: organization.created_by,
  });
  if (managerMembershipError) throw managerMembershipError;

  const { data: basePlan } = await supabaseAdmin
    .from("gym_membership_plans")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("slug", "base")
    .single();
  const { data: tempCustomer, error: tempCustomerError } = await supabaseAdmin
    .from("gym_customers")
    .insert({ organization_id: organization.id, user_id: member.id, plan_id: basePlan?.id, name: "Socio temporal", email: member.email, status: "active" })
    .select("id")
    .single();
  if (tempCustomerError || !tempCustomer) throw tempCustomerError ?? new Error("No se creó el socio temporal");
  tempCustomerId = tempCustomer.id;
  const membershipEnd = addDaysToISO(verificationStart, 29);
  const { error: tempMembershipError } = await supabaseAdmin.from("gym_customer_memberships").insert({
    organization_id: organization.id,
    customer_id: tempCustomer.id,
    plan_id: basePlan?.id,
    status: "active",
    starts_on: verificationStart,
    ends_on: membershipEnd,
    grace_ends_on: addDaysToISO(membershipEnd, 2),
    price_cents: 79900,
    class_credits_total: 8,
    source: "manual",
  });
  if (tempMembershipError) throw tempMembershipError;

  const managerClient = await signIn(manager.email);
  const { data: managerCustomers } = await managerClient.from("gym_customers").select("id").eq("organization_id", organization.id);
  assert(managerCustomers?.length === baselineCustomerCount + 1, "El manager no puede ver el roster de su organización.");
  const { data: managerUpdate, error: managerUpdateError } = await managerClient.from("gym_customers").update({ status: "paused" }).eq("id", tempCustomerId).select("id");
  assert(!managerUpdateError && managerUpdate?.length === 1, "El manager no puede actualizar el estado de un socio.");
  const { data: managerReactivate, error: managerReactivateError } = await managerClient.from("gym_customers").update({ status: "active" }).eq("id", tempCustomerId).select("id");
  assert(!managerReactivateError && managerReactivate?.length === 1, "El manager no puede reactivar al socio de prueba.");

  const memberClient = await signIn(member.email);
  const { data: memberCustomers } = await memberClient.from("gym_customers").select("id, status");
  assert(memberCustomers?.length === 1 && memberCustomers[0].id === tempCustomerId, "Un socio vio perfiles ajenos.");
  const occurrence = availability!.find((item: { class_date: string; class_id: string }) => item.class_date > verificationStart);
  assert(occurrence, "No hay una ocurrencia futura para probar reservas.");
  const { data: bookingStatus, error: bookingError } = await memberClient.rpc("gym_reserve_class", { p_class_id: occurrence.class_id, p_class_date: occurrence.class_date });
  assert(!bookingError && ["reserved", "waitlisted"].includes(bookingStatus), `El socio no pudo reservar una ocurrencia válida: ${bookingError?.message ?? bookingStatus}`);
  const { data: ownReservations } = await memberClient.from("gym_class_reservations").select("id, status").eq("customer_id", tempCustomerId);
  assert(ownReservations?.length === 1, "El socio no puede leer su propia reserva.");
  const { error: cancelError } = await memberClient.rpc("gym_cancel_reservation", { p_reservation_id: ownReservations![0].id });
  assert(!cancelError, "El socio no pudo cancelar su propia reserva.");
  const { error: forceWaitlistError } = await supabaseAdmin.from("gym_class_reservations").update({ status: "waitlisted" }).eq("id", ownReservations![0].id);
  if (forceWaitlistError) throw forceWaitlistError;
  const { error: demandError } = await memberClient.rpc("gym_request_schedule", { p_source_reservation_id: ownReservations![0].id, p_preferred_weekday: 6, p_preferred_time_window: "morning" });
  assert(!demandError, "El socio no pudo registrar demanda de horario.");
  const [{ data: managerReservations }, { data: managerDemand }] = await Promise.all([
    managerClient.from("gym_class_reservations").select("id").eq("customer_id", tempCustomerId),
    managerClient.from("gym_schedule_requests").select("id").eq("customer_id", tempCustomerId),
  ]);
  assert(managerReservations?.length === 1 && managerDemand?.length === 1, "Gestión no puede ver la operación del socio.");
  const { data: memberUpdate, error: memberUpdateError } = await memberClient.from("gym_customers").update({ status: "active" }).eq("id", tempCustomerId).select("id");
  assert(Boolean(memberUpdateError) || memberUpdate?.length === 0, "Un socio pudo cambiar su propio estado.");
  const [{ data: branch }, { data: serviceItem }] = await Promise.all([
    managerClient.from("gym_branches").select("id").eq("organization_id", organization.id).eq("is_primary", true).single(),
    managerClient.from("gym_catalog_items").select("id").eq("organization_id", organization.id).eq("slug", "evaluacion-corporal").single(),
  ]);
  assert(branch && serviceItem, "El catálogo comercial de ACTGym está incompleto.");
  const { data: sale, error: saleError } = await managerClient.rpc("gym_record_sale", {
    p_branch_id: branch.id,
    p_customer_id: tempCustomerId,
    p_items: [{ catalogItemId: serviceItem.id, quantity: 1 }],
    p_payment_method: "card",
    p_reference: "VERIFY",
  });
  assert(!saleError && sale?.orderId && sale?.receiptToken, `El POS no completó una venta atómica: ${saleError?.message ?? "sin recibo"}`);
  tempOrderId = sale.orderId;
  const [{ data: ownPayments }, { data: ownReceipts }] = await Promise.all([
    memberClient.from("gym_payments").select("id").eq("order_id", tempOrderId),
    memberClient.from("gym_receipts").select("id").eq("order_id", tempOrderId),
  ]);
  assert(ownPayments?.length === 1 && ownReceipts?.length === 1, "El socio no puede ver su pago y recibo.");

  const outsiderClient = await signIn(outsider.email);
  const [{ data: outsiderCustomers }, { data: outsiderReservations }, { data: outsiderDemand }, { data: outsiderPayments }, { error: outsiderBookingError }] = await Promise.all([
    outsiderClient.from("gym_customers").select("id"),
    outsiderClient.from("gym_class_reservations").select("id"),
    outsiderClient.from("gym_schedule_requests").select("id"),
    outsiderClient.from("gym_payments").select("id"),
    outsiderClient.rpc("gym_reserve_class", { p_class_id: occurrence.class_id, p_class_date: occurrence.class_date }),
  ]);
  assert(outsiderCustomers?.length === 0, "Un usuario ajeno vio socios de ACTGym.");
  assert(outsiderReservations?.length === 0 && outsiderDemand?.length === 0, "Un usuario ajeno vio la operación de ACTGym.");
  assert(outsiderPayments?.length === 0, "Un usuario ajeno vio cobros de ACTGym.");
  assert(Boolean(outsiderBookingError), "Un usuario sin membresía pudo reservar.");

  console.log("OK: sitio, membresía, reservas, demanda, POS, recibos y RLS respetan la frontera ACTGym.");
} finally {
  if (tempOrderId) {
    await supabaseAdmin.from("gym_receipts").delete().eq("order_id", tempOrderId);
    await supabaseAdmin.from("gym_payments").delete().eq("order_id", tempOrderId);
    await supabaseAdmin.from("gym_order_items").delete().eq("order_id", tempOrderId);
    await supabaseAdmin.from("gym_orders").delete().eq("id", tempOrderId);
  }
  if (tempCustomerId) await supabaseAdmin.from("gym_customers").delete().eq("id", tempCustomerId);
  for (const userId of createdUsers) await supabaseAdmin.auth.admin.deleteUser(userId);
}
