// Lista las sesiones bloqueadas (pasaron sus 20 días) que ya pidieron
// reapertura y siguen esperando autorización. No hay panel interno todavía
// (Fase 5), así que esta es la forma real de revisar solicitudes por ahora.
//
// Uso: bun run scripts/list-reopen-requests.ts
import { supabaseAdmin } from "../src/lib/supabase-admin";
import { computeSessionLockState } from "../src/features/business-discovery-agent/server/session-lock";

const { data, error } = await supabaseAdmin
  .from("discovery_sessions")
  .select("id, access_token, business_name_draft, submitted_at, reopen_requested_at, reopen_authorized_until")
  .not("reopen_requested_at", "is", null)
  .order("reopen_requested_at", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const pending = (data ?? []).filter((row) => computeSessionLockState(row).locked && row.reopen_requested_at);

if (pending.length === 0) {
  console.log("No hay solicitudes de reapertura pendientes.");
  process.exit(0);
}

for (const row of pending) {
  console.log(`— ${row.business_name_draft ?? "(sin nombre todavía)"}`);
  console.log(`  solicitado: ${row.reopen_requested_at}`);
  console.log(`  access_token: ${row.access_token}`);
  console.log(`  autorizar: bun run scripts/authorize-reopen.ts ${row.access_token}`);
  console.log();
}
