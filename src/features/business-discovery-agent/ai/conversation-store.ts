import type Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Reconstruye el historial completo para mandarlo a la API de Claude. Los
// bloques de imagen NO se vuelven a mandar en cada request (ver
// stripImageData abajo) — se leen como una nota de texto, porque Claude ya
// razonó sobre esa imagen la primera vez y lo que aprendió de ella ya quedó
// guardado vía save_discovery_response.
export async function loadConversationHistory(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const { data, error } = await supabaseAdmin
    .from("discovery_conversation_turns")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content as Anthropic.MessageParam["content"],
  }));
}

// Los bloques de imagen no se persisten con su base64 completo — se
// reemplazan por un marcador liviano para no inflar la tabla con megabytes
// repetidos en cada fila. Al reconstruir el historial (loadConversationHistory)
// este marcador se lee como texto plano; Claude no vuelve a "ver" la imagen
// en turnos futuros de la misma conversación.
function stripImageData(content: Anthropic.MessageParam["content"]): Anthropic.MessageParam["content"] {
  if (typeof content === "string") return content;
  return content.map((block) =>
    block.type === "image" ? { type: "text" as const, text: "[imagen ya analizada anteriormente, no se vuelve a mostrar]" } : block,
  );
}

function extractToolCalls(content: Anthropic.MessageParam["content"]): unknown {
  if (typeof content === "string") return null;
  const toolUses = content.filter((block) => block.type === "tool_use");
  return toolUses.length > 0 ? toolUses : null;
}

export async function persistTurn(sessionId: string, message: Anthropic.MessageParam): Promise<void> {
  const { error } = await supabaseAdmin.from("discovery_conversation_turns").insert({
    session_id: sessionId,
    role: message.role,
    content: stripImageData(message.content),
    tool_calls: extractToolCalls(message.content),
  });

  if (error) throw new Error(`No se pudo guardar el turno de conversación: ${error.message}`);
}

export async function persistTurns(sessionId: string, messages: Anthropic.MessageParam[]): Promise<void> {
  for (const message of messages) {
    await persistTurn(sessionId, message);
  }
}
