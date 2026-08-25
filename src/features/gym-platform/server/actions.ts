"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isBookableISODate, isUpcomingOccurrence } from "@/features/gym-platform/lib/calendar";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPublicGymPlatform, requireGymManager, requireGymMember } from "./data";

export type GymActionState = { ok: boolean; message?: string; receiptToken?: string };
type GymLoginMode = "member" | "manager";

function validSubdomain(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 63;
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function integerField(formData: FormData, name: string, minimum: number, maximum: number): number | null {
  const value = Number(String(formData.get(name) ?? ""));
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function currencyField(formData: FormData, name: string, maximumPesos: number): number | null {
  const value = Number(String(formData.get(name) ?? ""));
  if (!Number.isFinite(value) || value < 0 || value > maximumPesos) return null;
  return Math.round(value * 100);
}

function commerceError(message?: string): string {
  if (message?.includes("open cash session required")) return "Abre la caja antes de registrar una venta en efectivo.";
  if (message?.includes("insufficient inventory")) return "No hay inventario suficiente para completar la venta.";
  if (message?.includes("membership requires")) return "Selecciona un socio para vender una membresía.";
  return "No se pudo registrar la operación. Revisa los datos e intenta de nuevo.";
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

export async function reserveGymClass(
  subdomain: string,
  classId: string,
  classDate: string,
  _state: GymActionState,
  _formData: FormData,
): Promise<GymActionState> {
  void _state;
  void _formData;
  if (!validSubdomain(subdomain) || !validUuid(classId) || !isBookableISODate(classDate)) {
    return { ok: false, message: "La clase seleccionada no es válida." };
  }
  const access = await requireGymMember(subdomain);
  if (!access || access.customer.status !== "active") return { ok: false, message: "Necesitas una membresía activa para reservar." };
  const gymClass = access.platform.classes.find((item) => item.id === classId);
  if (!gymClass || !isUpcomingOccurrence(classDate, gymClass.startTime)) return { ok: false, message: "Esta sesión ya no admite reservas." };
  const { data, error } = await access.supabase.rpc("gym_reserve_class", {
    p_class_id: classId,
    p_class_date: classDate,
  });
  if (error || (data !== "reserved" && data !== "waitlisted")) return { ok: false, message: "No se pudo completar la reserva." };
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  return data === "reserved"
    ? { ok: true, message: "Lugar confirmado." }
    : { ok: true, message: "Clase llena: quedaste en lista de espera." };
}

export async function cancelGymReservation(
  subdomain: string,
  reservationId: string,
  _state: GymActionState,
  _formData: FormData,
): Promise<GymActionState> {
  void _state;
  void _formData;
  if (!validSubdomain(subdomain) || !validUuid(reservationId)) return { ok: false, message: "La reserva no es válida." };
  const access = await requireGymMember(subdomain);
  if (!access) return { ok: false, message: "No se encontró tu membresía." };
  const { data: ownedReservation, error: ownedReservationError } = await access.supabase
    .from("gym_class_reservations")
    .select("id")
    .eq("id", reservationId)
    .eq("organization_id", access.platform.site.organizationId)
    .eq("customer_id", access.customer.id)
    .in("status", ["reserved", "waitlisted"])
    .maybeSingle();
  if (ownedReservationError || !ownedReservation) return { ok: false, message: "La reserva no pertenece a esta cuenta." };
  const { error } = await access.supabase.rpc("gym_cancel_reservation", { p_reservation_id: reservationId });
  if (error) return { ok: false, message: "No se pudo cancelar la reserva." };
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: "Reserva cancelada." };
}

export async function requestGymSchedule(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const sourceReservationId = String(formData.get("sourceReservationId") ?? "");
  const weekdayValue = String(formData.get("weekday") ?? "");
  const weekday = Number(weekdayValue);
  const timeWindow = String(formData.get("timeWindow") ?? "");
  if (!validSubdomain(subdomain)
      || !validUuid(sourceReservationId)
      || !/^[0-6]$/.test(weekdayValue)
      || !Number.isInteger(weekday)
      || weekday < 0
      || weekday > 6
      || !["early", "morning", "midday", "evening", "night"].includes(timeWindow)) {
    return { ok: false, message: "El horario solicitado no es válido." };
  }
  const access = await requireGymMember(subdomain);
  if (!access || access.customer.status !== "active") return { ok: false, message: "Necesitas una membresía activa para solicitar horarios." };
  const { data: waitlistedReservation, error: waitlistError } = await access.supabase.from("gym_class_reservations")
    .select("id, class_id").eq("id", sourceReservationId).eq("customer_id", access.customer.id)
    .eq("organization_id", access.platform.site.organizationId).eq("status", "waitlisted").maybeSingle();
  if (waitlistError || !waitlistedReservation) return { ok: false, message: "Primero necesitas estar en lista de espera para esa clase." };
  const { error } = await access.supabase.rpc("gym_request_schedule", {
    p_source_reservation_id: sourceReservationId,
    p_preferred_weekday: weekday,
    p_preferred_time_window: timeWindow,
  });
  if (error) return { ok: false, message: "No se pudo registrar tu solicitud." };
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: "Solicitud registrada. El gimnasio podrá verla en Gestión." };
}

export async function openGymCashSession(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const branchId = String(formData.get("branchId") ?? "");
  const openingAmountCents = currencyField(formData, "openingAmountPesos", 1_000_000);
  if (!validSubdomain(subdomain) || !validUuid(branchId) || openingAmountCents === null) {
    return { ok: false, message: "El fondo inicial no es válido." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { error } = await access.supabase.rpc("gym_open_cash_session", {
    p_branch_id: branchId,
    p_opening_amount_cents: openingAmountCents,
  });
  if (error) return { ok: false, message: "Ya existe una caja abierta o no se pudo abrir." };
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: "Caja abierta. Ya puedes cobrar en efectivo." };
}

export async function closeGymCashSession(
  subdomain: string,
  sessionId: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const closingAmountCents = currencyField(formData, "closingAmountPesos", 1_000_000);
  if (!validSubdomain(subdomain) || !validUuid(sessionId) || closingAmountCents === null) {
    return { ok: false, message: "El monto de cierre no es válido." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { data, error } = await access.supabase.rpc("gym_close_cash_session", {
    p_session_id: sessionId,
    p_closing_amount_cents: closingAmountCents,
  });
  if (error) return { ok: false, message: "No se pudo cerrar la caja." };
  const difference = Number((data as { differenceCents?: number } | null)?.differenceCents ?? 0);
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: difference === 0 ? "Caja cerrada y conciliada." : `Caja cerrada con una diferencia de ${difference / 100} MXN.` };
}

export async function recordGymSale(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const branchId = String(formData.get("branchId") ?? "");
  const customerValue = String(formData.get("customerId") ?? "");
  const customerId = customerValue || null;
  const paymentMethod = String(formData.get("paymentMethod") ?? "");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120);
  let items: Array<{ catalogItemId: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(String(formData.get("items") ?? "[]")) as unknown;
    if (Array.isArray(parsed)) {
      items = parsed.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const catalogItemId = String((item as Record<string, unknown>).catalogItemId ?? "");
        const quantity = Number((item as Record<string, unknown>).quantity);
        return validUuid(catalogItemId) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 100
          ? [{ catalogItemId, quantity }]
          : [];
      });
    }
  } catch {
    return { ok: false, message: "El carrito no es válido." };
  }
  if (!validSubdomain(subdomain) || !validUuid(branchId)
      || (customerId !== null && !validUuid(customerId))
      || !["cash", "card", "bank_transfer"].includes(paymentMethod)
      || items.length < 1 || items.length > 30) {
    return { ok: false, message: "Revisa el carrito, el socio y la forma de pago." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { data, error } = await access.supabase.rpc("gym_record_sale", {
    p_branch_id: branchId,
    p_customer_id: customerId,
    p_items: items,
    p_payment_method: paymentMethod,
    p_reference: reference || null,
  });
  if (error || !data) return { ok: false, message: commerceError(error?.message) };
  const result = data as { orderNumber?: number; receiptToken?: string };
  revalidatePath(`/sites/${subdomain}/gestion`);
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  return {
    ok: true,
    message: `Venta #${result.orderNumber ?? "—"} registrada y recibo generado.`,
    receiptToken: result.receiptToken,
  };
}

export async function adjustGymInventory(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const branchId = String(formData.get("branchId") ?? "");
  const catalogItemId = String(formData.get("catalogItemId") ?? "");
  const quantityDelta = integerField(formData, "quantityDelta", -100_000, 100_000);
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (!validSubdomain(subdomain) || !validUuid(branchId) || !validUuid(catalogItemId)
      || quantityDelta === null || quantityDelta === 0) {
    return { ok: false, message: "El ajuste no es válido." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { data, error } = await access.supabase.rpc("gym_adjust_inventory", {
    p_branch_id: branchId,
    p_catalog_item_id: catalogItemId,
    p_quantity_delta: quantityDelta,
    p_note: note,
  });
  if (error) return { ok: false, message: commerceError(error.message) };
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: `Inventario actualizado: ${Number(data)} unidades.` };
}

export async function updateGymPlan(
  subdomain: string,
  planId: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const durationCount = integerField(formData, "durationCount", 1, 365);
  const durationUnit = String(formData.get("durationUnit") ?? "");
  const classAccess = String(formData.get("classAccess") ?? "");
  const classCreditsValue = String(formData.get("classCredits") ?? "");
  const classCredits = classAccess === "credits" ? Number(classCreditsValue) : null;
  const graceDays = integerField(formData, "graceDays", 0, 90);
  const priceCents = currencyField(formData, "pricePesos", 1_000_000);
  const autoRenewAvailable = formData.get("autoRenewAvailable") === "on";
  if (!validSubdomain(subdomain) || !validUuid(planId) || durationCount === null || graceDays === null || priceCents === null
      || !["day", "week", "month", "year"].includes(durationUnit)
      || !["none", "unlimited", "credits"].includes(classAccess)
      || (classAccess === "credits" && (!Number.isInteger(classCredits) || Number(classCredits) < 1 || Number(classCredits) > 1000))) {
    return { ok: false, message: "La configuración del plan no es válida." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { data, error } = await access.supabase.from("gym_membership_plans").update({
    duration_count: durationCount,
    duration_unit: durationUnit,
    class_access: classAccess,
    class_credits: classCredits,
    grace_days: graceDays,
    price_cents: priceCents,
    auto_renew_available: autoRenewAvailable,
  }).eq("id", planId).eq("organization_id", access.platform.site.organizationId).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo actualizar el plan." };
  await access.supabase.from("gym_catalog_items").update({ price_cents: priceCents })
    .eq("membership_plan_id", planId).eq("organization_id", access.platform.site.organizationId);
  revalidatePath(`/sites/${subdomain}`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  return { ok: true, message: "Plan actualizado." };
}

export async function updateGymOperationsSettings(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const threshold = integerField(formData, "scheduleInterestThreshold", 2, 50);
  const holdHours = integerField(formData, "demandHoldHours", 1, 168);
  if (!validSubdomain(subdomain) || threshold === null || holdHours === null) {
    return { ok: false, message: "La configuración operativa no es válida." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const { data, error } = await access.supabase.from("organization_sites").update({
    schedule_interest_threshold: threshold,
    demand_hold_hours: holdHours,
  }).eq("organization_id", access.platform.site.organizationId).select("organization_id").maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo guardar la configuración." };
  revalidatePath(`/sites/${subdomain}`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  return { ok: true, message: "Reglas operativas guardadas." };
}

export async function approveGymDemand(
  subdomain: string,
  classId: string,
  weekday: number,
  timeWindow: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const branchId = String(formData.get("branchId") ?? "");
  const startsAtLocal = String(formData.get("startsAt") ?? "");
  const capacity = integerField(formData, "capacity", 1, 200);
  const priceCents = currencyField(formData, "pricePesos", 100_000);
  if (!validSubdomain(subdomain) || !validUuid(classId) || !validUuid(branchId)
      || !Number.isInteger(weekday) || weekday < 0 || weekday > 6
      || !["early", "morning", "midday", "evening", "night"].includes(timeWindow)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAtLocal)
      || capacity === null || priceCents === null) {
    return { ok: false, message: "La fecha, el cupo o el precio no son válidos." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const startsAt = `${startsAtLocal}:00-06:00`;
  if (Date.parse(startsAt) <= Date.now()) return { ok: false, message: "La sesión adicional debe ser futura." };
  const { data, error } = await access.supabase.rpc("gym_approve_demand", {
    p_class_id: classId,
    p_preferred_weekday: weekday,
    p_preferred_time_window: timeWindow,
    p_branch_id: branchId,
    p_starts_at: startsAt,
    p_capacity: capacity,
    p_price_cents: priceCents,
  });
  if (error || !data) {
    return { ok: false, message: error?.message.includes("threshold") ? "La señal todavía no alcanza el mínimo configurado." : "No se pudo autorizar la clase adicional." };
  }
  const holdCount = Number((data as { holdCount?: number }).holdCount ?? 0);
  revalidatePath(`/sites/${subdomain}/gestion`);
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  return { ok: true, message: `Clase autorizada: ${holdCount} apartados creados. Los WhatsApp quedaron en borrador.` };
}

export async function createGymCatalogItem(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase().slice(0, 40) || null;
  const itemType = String(formData.get("itemType") ?? "");
  const priceCents = currencyField(formData, "pricePesos", 1_000_000);
  const costCents = currencyField(formData, "costPesos", 1_000_000);
  const initialQuantity = integerField(formData, "initialQuantity", 0, 100_000);
  const branchId = String(formData.get("branchId") ?? "");
  if (!validSubdomain(subdomain) || name.length < 1 || !["product", "service", "class_pack", "drop_in"].includes(itemType)
      || priceCents === null || costCents === null || initialQuantity === null || !validUuid(branchId)) {
    return { ok: false, message: "Revisa el nombre, tipo, precio e inventario inicial." };
  }
  const access = await requireGymManager(subdomain);
  if (!access) return { ok: false, message: "Plataforma no disponible." };
  const slugBase = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "concepto";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;
  const tracksInventory = itemType === "product";
  const { data, error } = await access.supabase.from("gym_catalog_items").insert({
    organization_id: access.platform.site.organizationId,
    slug,
    sku,
    item_type: itemType,
    name,
    price_cents: priceCents,
    cost_cents: costCents,
    tracks_inventory: tracksInventory,
    active: true,
    published: itemType !== "product",
  }).select("id").single();
  if (error || !data) return { ok: false, message: error?.message.includes("sku") ? "Ese SKU ya existe." : "No se pudo crear el concepto." };
  if (tracksInventory && initialQuantity > 0) {
    const { error: inventoryError } = await access.supabase.rpc("gym_adjust_inventory", {
      p_branch_id: branchId,
      p_catalog_item_id: data.id,
      p_quantity_delta: initialQuantity,
      p_note: "Inventario inicial",
    });
    if (inventoryError) return { ok: false, message: "El concepto se creó, pero no se pudo cargar su inventario inicial." };
  }
  revalidatePath(`/sites/${subdomain}`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: `${name} ya está disponible en el punto de venta.` };
}

export async function updateGymMemberProfile(
  subdomain: string,
  _state: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 24);
  if (!validSubdomain(subdomain) || !name) return { ok: false, message: "Escribe un nombre válido." };
  const access = await requireGymMember(subdomain);
  if (!access) return { ok: false, message: "No se encontró tu cuenta." };
  const { data, error } = await access.supabase.rpc("gym_update_customer_profile", { p_name: name, p_phone: phone });
  if (error || !data) return { ok: false, message: "Revisa el teléfono; debe incluir 10 a 15 dígitos." };
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  return { ok: true, message: "Perfil actualizado." };
}

export async function confirmGymClassHold(
  subdomain: string,
  holdToken: string,
  _state: GymActionState,
  _formData: FormData,
): Promise<GymActionState> {
  void _formData;
  if (!validSubdomain(subdomain) || !validUuid(holdToken)) return { ok: false, message: "El apartado no es válido." };
  const access = await requireGymMember(subdomain);
  if (!access) return { ok: false, message: "No se encontró tu cuenta." };
  const { data, error } = await access.supabase.rpc("gym_confirm_class_hold", { p_public_token: holdToken });
  if (error || !data) return { ok: false, message: error?.message.includes("payment required") ? "Este apartado necesita pago antes de confirmarse." : "El apartado venció o ya no está disponible." };
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  return { ok: true, message: "Lugar confirmado. El gimnasio ya recibió tu respuesta." };
}
