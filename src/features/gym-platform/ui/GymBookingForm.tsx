"use client";

import { useActionState } from "react";
import { cancelGymReservation, reserveGymClass, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymReservationStatus } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

export function GymBookingForm({
  subdomain,
  classId,
  classDate,
  reservationId,
  reservationStatus,
  availableSpots,
}: {
  subdomain: string;
  classId: string;
  classDate: string;
  reservationId: string | null;
  reservationStatus: GymReservationStatus | null;
  availableSpots: number;
}) {
  const action = reservationId
    ? cancelGymReservation.bind(null, subdomain, reservationId)
    : reserveGymClass.bind(null, subdomain, classId, classDate);
  const [state, formAction, pending] = useActionState(action, initialState);
  const activeReservation = reservationStatus === "reserved" || reservationStatus === "waitlisted";
  const label = activeReservation
    ? reservationStatus === "waitlisted" ? "Salir de la lista" : "Cancelar reserva"
    : availableSpots > 0 ? "Reservar lugar" : "Entrar a lista de espera";

  return (
    <form action={formAction} className="gym-booking-form">
      <button type="submit" disabled={pending}>{pending ? "Actualizando…" : label}</button>
      {state.message ? <span className={state.ok ? "is-ok" : "is-error"} aria-live="polite">{state.message}</span> : null}
    </form>
  );
}
