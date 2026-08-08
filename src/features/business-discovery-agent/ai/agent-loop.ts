import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, DISCOVERY_AGENT_MODEL } from "./client";
import { buildSystemPrompt } from "./system-prompt";
import {
  CONFIRM_SECTION_RESPONSES_TOOL,
  DISCOVERY_AGENT_TOOLS,
  SAVE_DISCOVERY_RESPONSE_TOOL,
  sectionIdForQuestion,
  type ConfirmSectionResponsesInput,
  type SaveDiscoveryResponseInput,
} from "./tools";
import { confirmDraftResponses, saveResponse, updateBusinessNameDraft } from "../server/actions";

// Preguntas cuyo valor, al guardarse, también se refleja en
// discovery_sessions.business_name_draft — por ahora solo el nombre del
// negocio (ver DiscoveryWelcomeScreen.tsx, que ya no lo pide de antemano).
const BUSINESS_NAME_QUESTION_ID = "biz.name";

// Loop manual (no Tool Runner) — decisión aprobada: control total sobre cada
// tool_use, sin depender de una feature beta del SDK. Ver
// docs/business-discovery-agent/AI-AGENT-DESIGN.md §7.
const MAX_TOOL_ITERATIONS = 8;

export interface AgentTurnResult {
  assistantText: string;
  // Todos los mensajes generados en este turno (el user turn de entrada +
  // cualquier assistant/tool_result intermedio) — se persisten tal cual con
  // conversation-store.persistTurns.
  newMessages: Anthropic.MessageParam[];
  // question_id que se guardaron con éxito (status "draft") en este turno —
  // la UI lo usa para el highlight puntual de Lumen Haze ("dato recién
  // confirmado"), nunca para nada estructural.
  savedQuestionIds: string[];
}

async function executeTool(
  sessionId: string,
  block: Anthropic.ToolUseBlock,
): Promise<{ content: string; isError: boolean; savedQuestionId?: string }> {
  if (block.name === SAVE_DISCOVERY_RESPONSE_TOOL.name) {
    const input = block.input as SaveDiscoveryResponseInput;
    const sectionId = sectionIdForQuestion(input.question_id);
    if (!sectionId) {
      return { content: `question_id desconocido: "${input.question_id}". No existe en el pack.`, isError: true };
    }

    const result = await saveResponse({
      sessionId,
      questionId: input.question_id,
      sectionId,
      value: input.value,
      status: input.status,
      source: input.source,
      confidence: input.confidence,
      originRef: input.origin_ref,
    });

    if (!result.ok) return { content: `No se pudo guardar: ${result.error}`, isError: true };

    if (input.question_id === BUSINESS_NAME_QUESTION_ID && typeof input.value === "string" && input.value.trim()) {
      await updateBusinessNameDraft(sessionId, input.value.trim());
    }

    return { content: "guardado", isError: false, savedQuestionId: input.question_id };
  }

  if (block.name === CONFIRM_SECTION_RESPONSES_TOOL.name) {
    const input = block.input as ConfirmSectionResponsesInput;
    const result = await confirmDraftResponses(sessionId, input.question_ids);
    if (!result.ok) return { content: `No se pudo confirmar: ${result.error}`, isError: true };
    return { content: "confirmado", isError: false };
  }

  return { content: `Tool desconocido: ${block.name}`, isError: true };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export async function runAgentTurn(params: {
  sessionId: string;
  businessNameDraft: string | null;
  history: Anthropic.MessageParam[];
  newUserMessage: Anthropic.MessageParam;
}): Promise<AgentTurnResult> {
  const { sessionId, businessNameDraft, history, newUserMessage } = params;

  const messages: Anthropic.MessageParam[] = [...history, newUserMessage];
  const newMessages: Anthropic.MessageParam[] = [newUserMessage];
  const savedQuestionIds: string[] = [];
  const system = buildSystemPrompt(businessNameDraft);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropicClient.messages.create({
      model: DISCOVERY_AGENT_MODEL,
      max_tokens: 2048,
      // Thinking apagado y effort medio: es un chat interactivo de cara al
      // usuario — la latencia importa más que el razonamiento profundo para
      // este tipo de conversación guiada.
      thinking: { type: "disabled" },
      output_config: { effort: "medium" },
      system,
      tools: DISCOVERY_AGENT_TOOLS,
      messages,
    });

    const assistantMessage: Anthropic.MessageParam = { role: "assistant", content: response.content };
    messages.push(assistantMessage);
    newMessages.push(assistantMessage);

    if (response.stop_reason !== "tool_use") {
      return { assistantText: extractText(response.content), newMessages, savedQuestionIds };
    }

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await executeTool(sessionId, block);
      if (result.savedQuestionId) savedQuestionIds.push(result.savedQuestionId);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError,
      });
    }

    const toolResultMessage: Anthropic.MessageParam = { role: "user", content: toolResults };
    messages.push(toolResultMessage);
    newMessages.push(toolResultMessage);
  }

  // Se agotaron las iteraciones de tool_use sin que el modelo cerrara con
  // texto (raro, pero observado en pruebas reales con varios tool calls en
  // un mismo turno). En vez de mostrar un mensaje genérico que contradice lo
  // que sí pasó (los datos ya están guardados), se fuerza un cierre de solo
  // texto con tool_choice "none" — el modelo ya tiene todo el contexto de
  // los tool_result en `messages`, solo le falta redactar la respuesta.
  const closingResponse = await anthropicClient.messages.create({
    model: DISCOVERY_AGENT_MODEL,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    output_config: { effort: "medium" },
    system,
    tool_choice: { type: "none" },
    tools: DISCOVERY_AGENT_TOOLS,
    messages,
  });

  const closingMessage: Anthropic.MessageParam = { role: "assistant", content: closingResponse.content };
  messages.push(closingMessage);
  newMessages.push(closingMessage);

  return {
    assistantText:
      extractText(closingResponse.content) || "Ya guardé lo que me contaste — sigamos con lo siguiente.",
    newMessages,
    savedQuestionIds,
  };
}
