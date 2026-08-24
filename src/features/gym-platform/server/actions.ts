"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isBookableISODate, isUpcomingOccurrence } from "@/features/gym-platform/lib/calendar";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPublicGymPlatform, requireGymManager, requireGymMember } from "./data";

export type GymActionState = { ok: boolean; message?: string };
type GymLoginMode = "member" | "manager";

function validSubdomain(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 63;
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  const classId = String(formData.get("classId") ?? "");
  const weekdayValue = String(formData.get("weekday") ?? "");
  const weekday = Number(weekdayValue);
  const timeWindow = String(formData.get("timeWindow") ?? "");
  if (!validSubdomain(subdomain)
      || !validUuid(classId)
      || !/^[0-6]$/.test(weekdayValue)
      || !Number.isInteger(weekday)
      || weekday < 0
      || weekday > 6
      || !["early", "morning", "midday", "evening", "night"].includes(timeWindow)) {
    return { ok: false, message: "El horario solicitado no es válido." };
  }
  const access = await requireGymMember(subdomain);
  if (!access || access.customer.status !== "active") return { ok: false, message: "Necesitas una membresía activa para solicitar horarios." };
  if (!access.platform.classes.some((gymClass) => gymClass.id === classId)) return { ok: false, message: "La clase no pertenece a este gimnasio." };
  const { error } = await access.supabase.rpc("gym_request_schedule", {
    p_class_id: classId,
    p_preferred_weekday: weekday,
    p_preferred_time_window: timeWindow,
  });
  if (error) return { ok: false, message: "No se pudo registrar tu solicitud." };
  revalidatePath(`/sites/${subdomain}/mi-cuenta`);
  revalidatePath(`/sites/${subdomain}/gestion`);
  return { ok: true, message: "Solicitud registrada. El gimnasio podrá verla en Gestión." };
}
