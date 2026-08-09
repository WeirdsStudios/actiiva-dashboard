// Autoriza la reapertura de una sesión bloqueada — lo único que en verdad
// desbloquea el chat (ver server/session-lock.ts). Extiende el acceso
// `días` a partir de ahora (default 20, mismo tamaño que la ventana
// original) y limpia reopen_requested_at para que una solicitud futura, si
// vuelve a bloquearse más adelante, no arrastre esta ya resuelta.
//
// Uso:
//   bun run scripts/authorize-reopen.ts <accessToken>
//   bun run scripts/authorize-reopen.ts <accessToken> 7
import { supabaseAdmin } from "../src/lib/supabase-admin";

const accessToken = process.argv[2];
const days = Number(process.argv[3] ?? 20);

if (!accessToken || Number.isNaN(days) || days <= 0) {
  console.error("uso: bun run scripts/authorize-reopen.ts <accessToken> [días=20]");
  process.exit(1);
}

const authorizedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const { data, error } = await supabaseAdmin
  .from("discovery_sessions")
  .update({ reopen_authorized_until: authorizedUntil, reopen_requested_at: null })
  .eq("access_token", accessToken)
  .select("business_name_draft")
  .maybeSingle();

if (error || !data) {
  console.error(error?.message ?? "No se encontró ninguna sesión con ese access_token.");
  process.exit(1);
}

console.log(`Autorizado: ${data.business_name_draft ?? "(sin nombre)"} puede seguir hasta ${authorizedUntil}.`);
console.log(`Link: http://localhost:3000/discovery/${accessToken}  (o el dominio de producción)`);
