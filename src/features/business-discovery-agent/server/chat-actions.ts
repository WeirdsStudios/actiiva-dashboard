"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runAgentTurn } from "../ai/agent-loop";
import { loadConversationHistory, persistTurns } from "../ai/conversation-store";
import { fileToImageBlock, isVisionSupportedMimeType } from "../ai/image-handling";
import { CONVERSATION_KICKOFF_MARKER } from "../ai/system-prompt";
import { computeSessionLockState } from "./session-lock";
import { reopenDiscoverySessionIfSubmitted, requestSessionReopen, saveResponse, uploadDiscoveryAsset } from "./actions";
import { authorizeDiscoverySession } from "./access-control";
import { redactSensitiveFinancialNumbers } from "./content-safety";

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
export async function getChatHistory(sessionId: string, accessToken: string): Promise<ChatTurnView[]> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return [];
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

export async function sendChatMessage(sessionId: string, accessToken: string, formData: FormData): Promise<SendResult> {
  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const file = formData.get("file");
  const fileQuestionId = formData.get("fileQuestionId") as string | null;

  if (!message && !(file instanceof File)) {
    return { ok: false, error: "Escribe un mensaje o adjunta un archivo." };
  }
  if (message.length > 10_000) {
    return { ok: false, error: "El mensaje es demasiado largo. Envíalo en partes más pequeñas." };
  }

  const { data: claimResult, error: claimError } = await supabaseAdmin.rpc("claim_discovery_agent_turn", {
    p_session_id: sessionId,
    p_access_token: accessToken,
  });

  if (claimError) return { ok: false, error: "No se pudo iniciar el turno. Intenta de nuevo." };
  if (claimResult !== "claimed") {
    const claimMessages: Record<string, string> = {
      unauthorized: "No se pudo validar el acceso a esta sesión.",
      expired: "Este enlace ya expiró. Solicita uno nuevo a ACTIIVA.",
      locked: "Esta sesión ya fue aprobada y no admite más cambios.",
      busy: "Ya estamos procesando otro mensaje. Espera un momento.",
      rate_limited: "Espera un par de segundos antes de enviar otro mensaje.",
      limit_reached: "Esta conversación llegó a su límite. Contacta a ACTIIVA para continuar.",
    };
    return { ok: false, error: claimMessages[String(claimResult)] ?? "No se pudo iniciar el turno." };
  }

  try {
    const { data: sessionRow } = await supabaseAdmin
      .from("discovery_sessions")
      .select("business_name_draft, status, submitted_at, reopen_requested_at, reopen_authorized_until")
      .eq("id", sessionId)
      .eq("access_token", accessToken)
      .maybeSingle();

    if (!sessionRow) return { ok: false, error: "Sesión no encontrada." };

    if (sessionRow.status === "approved" || computeSessionLockState(sessionRow).locked) {
      return {
        ok: false,
        error: "Esta sesión ya pasó su ventana de ajuste de 20 días. Solicita la reapertura desde el link original.",
      };
    }

    if (sessionRow.status === "submitted") {
      await reopenDiscoverySessionIfSubmitted(sessionId, accessToken);
    }

    const contentBlocks: Anthropic.MessageParam["content"] = [];

    if (file instanceof File) {
      if (!fileQuestionId) return { ok: false, error: "Falta indicar para qué es el archivo." };

      const uploadResult = await uploadDiscoveryAsset(sessionId, accessToken, fileQuestionId, formData);
      if (!uploadResult.ok) return { ok: false, error: uploadResult.error };

      const saveFileResponse = await saveResponse({
        sessionId,
        accessToken,
        questionId: fileQuestionId,
        value: [uploadResult.asset.filename],
        status: "draft",
        source: "user_input",
      });
      if (!saveFileResponse.ok) return saveFileResponse;

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

    if (message) contentBlocks.push({ type: "text", text: redactSensitiveFinancialNumbers(message) });

    const newUserMessage: Anthropic.MessageParam = { role: "user", content: contentBlocks };
    const history = await loadConversationHistory(sessionId);

    const { assistantText, newMessages, savedQuestionIds } = await runAgentTurn({
      sessionId,
      accessToken,
      businessNameDraft: sessionRow.business_name_draft ?? null,
      history,
      newUserMessage,
    });

    await persistTurns(sessionId, newMessages);

    return {
      ok: true,
      reply: assistantText || "Perdón, no capté eso — ¿puedes intentarlo de otra forma?",
      savedCount: savedQuestionIds.length,
    };
  } catch (error) {
    console.error("Falló un turno del agente de discovery:", error);
    return { ok: false, error: "No se pudo procesar el mensaje. Tu sesión sigue guardada; intenta de nuevo." };
  } finally {
    await supabaseAdmin.rpc("release_discovery_agent_turn", { p_session_id: sessionId });
  }
}

// Para el header del chat y la pantalla de bienvenida — getSessionByAccessToken
// (server/actions.ts) no selecciona esta columna, así que se consulta aparte
// en vez de ampliar esa función para todos sus otros callers.
export async function getBusinessNameDraft(sessionId: string, accessToken: string): Promise<string | null> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return null;
  const { data } = await supabaseAdmin
    .from("discovery_sessions")
    .select("business_name_draft")
    .eq("id", sessionId)
    .maybeSingle();
  return data?.business_name_draft ?? null;
}

export async function startConversation(sessionId: string, accessToken: string): Promise<SendResult> {
  const formData = new FormData();
  formData.set("message", CONVERSATION_KICKOFF_MARKER);
  return sendChatMessage(sessionId, accessToken, formData);
}

// Llamado por el botón "Solicitar reapertura" de DiscoverySessionLockedScreen.
export async function requestReopen(
  sessionId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return requestSessionReopen(sessionId, accessToken);
}
