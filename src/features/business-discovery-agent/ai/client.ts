import Anthropic from "@anthropic-ai/sdk";

// Mismo patrón que src/lib/supabase-admin.ts: solo se importa desde código
// server-side (server actions), variable de entorno leída con `!` porque el
// repo ya sigue esa convención para credenciales server-only.
export const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const DISCOVERY_AGENT_MODEL = "claude-sonnet-5";
