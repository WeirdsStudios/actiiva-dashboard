import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeSessionLockState, type SessionLockFields } from "./session-lock";

export interface AuthorizedDiscoverySession extends SessionLockFields {
  id: string;
  status: string;
  business_name_draft: string | null;
  token_expires_at: string;
}

type AccessOptions = {
  allowExpired?: boolean;
  allowLocked?: boolean;
};

export async function authorizeDiscoverySession(
  sessionId: string,
  accessToken: string,
  options: AccessOptions = {},
): Promise<
  | { ok: true; session: AuthorizedDiscoverySession }
  | { ok: false; reason: "unauthorized" | "expired" | "locked" }
> {
  if (!sessionId || !accessToken) return { ok: false, reason: "unauthorized" };

  const { data } = await supabaseAdmin
    .from("discovery_sessions")
    .select(
      "id, status, business_name_draft, token_expires_at, submitted_at, reopen_requested_at, reopen_authorized_until",
    )
    .eq("id", sessionId)
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!data) return { ok: false, reason: "unauthorized" };
  if (!options.allowExpired && new Date(data.token_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (!options.allowLocked && data.status === "approved") {
    return { ok: false, reason: "locked" };
  }
  if (!options.allowLocked && computeSessionLockState(data).locked) {
    return { ok: false, reason: "locked" };
  }

  return { ok: true, session: data as AuthorizedDiscoverySession };
}

export function accessErrorMessage(reason: "unauthorized" | "expired" | "locked"): string {
  if (reason === "expired") return "Este enlace ya expiró. Solicita uno nuevo a ACTIIVA.";
  if (reason === "locked") return "Esta sesión está cerrada para cambios. Solicita una reapertura.";
  return "No se pudo validar el acceso a esta sesión.";
}
