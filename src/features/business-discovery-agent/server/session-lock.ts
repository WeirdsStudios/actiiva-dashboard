// Ventana de ajuste tras el primer cierre — compartida con
// export/build-export.ts (tenant-seed.json.adjustmentDeadlineAt). Una sola
// fuente de verdad para el número "20", no dos constantes que se puedan
// desincronizar.
export const ADJUSTMENT_WINDOW_DAYS = 20;

export interface SessionLockFields {
  submitted_at: string | null;
  reopen_requested_at: string | null;
  reopen_authorized_until: string | null;
}

export interface SessionLockState {
  locked: boolean;
  // true si ya pasó la ventana original de 20 días y el negocio ya mandó su
  // solicitud de reapertura (para que la pantalla de bloqueo muestre "ya
  // solicitaste, esperando autorización" en vez del botón).
  reopenRequested: boolean;
}

// Se bloquea SOLO si la sesión ya se cerró alguna vez (submitted_at no es
// null) y pasaron más de 20 días desde ese primer cierre — nunca antes de
// que exista un primer cierre, y nunca de forma permanente: una
// reopen_authorized_until en el futuro desbloquea, sin importar cuánto haya
// pasado del plazo original. Ver server/actions.ts (closeDiscoverySession,
// requestSessionReopen) para quién escribe estos campos.
export function computeSessionLockState(session: SessionLockFields): SessionLockState {
  if (!session.submitted_at) {
    return { locked: false, reopenRequested: false };
  }

  const deadline = new Date(session.submitted_at).getTime() + ADJUSTMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now <= deadline) {
    return { locked: false, reopenRequested: false };
  }

  const authorizedUntil = session.reopen_authorized_until ? new Date(session.reopen_authorized_until).getTime() : null;
  if (authorizedUntil !== null && now <= authorizedUntil) {
    return { locked: false, reopenRequested: false };
  }

  return { locked: true, reopenRequested: session.reopen_requested_at !== null };
}
