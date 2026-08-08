"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runAgentTurn } from "../ai/agent-loop";
import { loadConversationHistory, persistTurns } from "../ai/conversation-store";
import { fileToImageBlock, isVisionSupportedMimeType } from "../ai/image-handling";
import { CONVERSATION_KICKOFF_MARKER } from "../ai/system-prompt";
import { sectionIdForQuestion } from "../ai/tools";
import { saveResponse, uploadDiscoveryAsset } from "./actions";

export interface ChatTurnView {
  role: "user" | "assistant";
  text: string;
  savedCount?: number;
}

function contentToDisplayText(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block): block is Anthropic.TextBlockParam => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

// Turnos de solo tool_use/tool_result no tienen texto para mostrar, y el
// mensaje de arranque (CONVERSATION_KICKOFF_MARKER) es una señal técnica, no
// contenido real del usuario — ambos se ocultan de la vista de chat.
export async function getChatHistory(sessionId: string): Promise<ChatTurnView[]> {
  const history = await loadConversationHistory(sessionId);
  return history
    // El schema de discovery_conversation_turns solo permite role
    // 'user'/'assistant' (check constraint) — el tipo del SDK admite también
    // 'system' porque cubre el caso general de mid-conversation system
    // messages, que este agente no usa.
    .map((message) => ({ role: message.role as "user" | "assistant", text: contentToDisplayText(message.content) }))
    .filter((turn) => turn.text.length > 0 && turn.text !== CONVERSATION_KICKOFF_MARKER);
}

type SendResult = { ok: true; reply: string; savedCount: number } | { ok: false; error: string };

export async function sendChatMessage(sessionId: string, formData: FormData): Promise<SendResult> {
  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const file = formData.get("file");
  const fileQuestionId = formData.get("fileQuestionId") as string | null;

  if (!message && !(file instanceof File)) {
    return { ok: false, error: "Escribe un mensaje o adjunta un archivo." };
  }

  const { data: sessionRow } = await supabaseAdmin
    .from("discovery_sessions")
    .select("business_name_draft")
    .eq("id", sessionId)
    .maybeSingle();

  const contentBlocks: Anthropic.MessageParam["content"] = [];

  if (file instanceof File) {
    if (!fileQuestionId) return { ok: false, error: "Falta indicar para qué es el archivo." };

    // uploadDiscoveryAsset ya existe de Fase 2, sin cambios: sube a Supabase
    // Storage y registra la fila en discovery_assets igual que en el flujo
    // determinista.
    const uploadResult = await uploadDiscoveryAsset(sessionId, fileQuestionId, formData);
    if (!uploadResult.ok) return { ok: false, error: uploadResult.error };

    // El servidor registra la respuesta de la pregunta file_upload por su
    // cuenta, sin depender de que el modelo lo recuerde — necesario para que
    // computeSectionProgress (que lee discovery_responses, no
    // discovery_assets) refleje el avance. Ver AI-AGENT-DESIGN.md §6.1 paso 5.
    const sectionId = sectionIdForQuestion(fileQuestionId);
    if (sectionId) {
      await saveResponse({
        sessionId,
        questionId: fileQuestionId,
        sectionId,
        value: [uploadResult.asset.filename],
        status: "draft",
        source: "user_input",
      });
    }

    if (isVisionSupportedMimeType(file.type)) {
      const imageBlock = await fileToImageBlock(file);
      if (imageBlock) contentBlocks.push(imageBlock);
      contentBlocks.push({ type: "text", text: `[archivo subido: ${file.name}, para "${fileQuestionId}"]` });
    } else {
      contentBlocks.push({
        type: "text",
        text: `[el usuario subió un archivo que no se puede previsualizar (${file.name}), para "${fileQuestionId}". No intentes describir su contenido — sigue la instrucción de respaldo para este caso.]`,
      });
    }
  }

  if (message) contentBlocks.push({ type: "text", text: message });

  const newUserMessage: Anthropic.MessageParam = { role: "user", content: contentBlocks };
  const history = await loadConversationHistory(sessionId);

  const { assistantText, newMessages, savedQuestionIds } = await runAgentTurn({
    sessionId,
    businessNameDraft: sessionRow?.business_name_draft ?? null,
    history,
    newUserMessage,
  });

  await persistTurns(sessionId, newMessages);

  return {
    ok: true,
    reply: assistantText || "Perdón, no capté eso — ¿puedes intentarlo de otra forma?",
    savedCount: savedQuestionIds.length,
  };
}

// Para el header del chat y la pantalla de bienvenida — getSessionByAccessToken
// (server/actions.ts) no selecciona esta columna, así que se consulta aparte
// en vez de ampliar esa función para todos sus otros callers.
export async function getBusinessNameDraft(sessionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("discovery_sessions")
    .select("business_name_draft")
    .eq("id", sessionId)
    .maybeSingle();
  return data?.business_name_draft ?? null;
}

export async function startConversation(sessionId: string): Promise<SendResult> {
  const formData = new FormData();
  formData.set("message", CONVERSATION_KICKOFF_MARKER);
  return sendChatMessage(sessionId, formData);
}
