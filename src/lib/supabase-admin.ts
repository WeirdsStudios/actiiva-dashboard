import { createClient } from "@supabase/supabase-js";

// Solo se importa desde código server-side (server actions, route handlers).
// Usa la service role key — nunca debe llegar a un componente cliente.
// NO se agregó el paquete `server-only` (que haría esto un error de build si
// se importa por accidente desde un componente cliente) para no instalar una
// dependencia nueva sin pedir permiso primero — repo rule del CLAUDE.md raíz.
// Si quieres ese refuerzo, es un solo paquete sin dependencias, aviso y lo agrego.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
