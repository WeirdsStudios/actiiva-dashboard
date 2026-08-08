// Crea una discovery_session real y muestra el link listo para mandarle a un
// cliente. Reemplaza a scripts/seed-test-session.ts (Fase 5 — /admin/discovery
// — todavía no existe; hasta que exista, este es el camino real para generar
// un link de onboarding, no solo un script de prueba).
//
// El nombre del negocio es opcional a propósito: el agente ya lo pregunta
// como su primer tema real (biz.name) y lo hace persistir vía
// updateBusinessNameDraft (ver ai/agent-loop.ts) — no hace falta teclearlo
// aquí para que el chat funcione. Pásalo solo si quieres identificar la
// sesión de un vistazo antes de que el negocio conteste algo.
//
// Uso:
//   bun run scripts/create-discovery-session.ts
//   bun run scripts/create-discovery-session.ts "Hot Legs Cardio"
//   DISCOVERY_BASE_URL=https://actiiva.mx bun run scripts/create-discovery-session.ts
import { supabaseAdmin } from "../src/lib/supabase-admin";

const businessName = process.argv[2]?.trim() || null;
const baseUrl = process.env.DISCOVERY_BASE_URL ?? "http://localhost:3000";

const { data, error } = await supabaseAdmin
  .from("discovery_sessions")
  .insert({
    pack_id: "question-pack-actiiva",
    pack_version: "0.2.0",
    ...(businessName ? { business_name_draft: businessName } : {}),
  })
  .select("access_token")
  .single();

if (error || !data) {
  console.error(error?.message ?? "No se pudo crear la sesión");
  process.exit(1);
}

console.log(`${baseUrl}/discovery/${data.access_token}`);
