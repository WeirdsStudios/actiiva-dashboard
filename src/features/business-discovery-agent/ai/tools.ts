import type Anthropic from "@anthropic-ai/sdk";
import { questionPackActiiva } from "../packs/actiiva";

// Mapa question_id -> section_id, construido una sola vez desde el pack real.
// El modelo NUNCA manda section_id — lo resolvemos aquí para que sea
// imposible que un tool call tenga un par question_id/section_id
// inconsistente (ver AI-AGENT-DESIGN.md §3.1).
const QUESTION_ID_TO_SECTION_ID = new Map(questionPackActiiva.questions.map((q) => [q.id, q.sectionId]));

export function sectionIdForQuestion(questionId: string): string | undefined {
  return QUESTION_ID_TO_SECTION_ID.get(questionId);
}

// Enum generado desde el pack — no se duplica la lista de 37 ids a mano, así
// que no se puede desincronizar si el pack cambia.
const ALL_QUESTION_IDS = questionPackActiiva.questions.map((q) => q.id);

export const FILE_UPLOAD_QUESTIONS = questionPackActiiva.questions.filter((q) => q.type === "file_upload");

export type SaveDiscoveryResponseStatus = "draft" | "flagged_missing" | "unknown";
export type SaveDiscoveryResponseSource = "user_input" | "ai_extracted";

export interface SaveDiscoveryResponseInput {
  question_id: string;
  value: unknown;
  status: SaveDiscoveryResponseStatus;
  source: SaveDiscoveryResponseSource;
  confidence?: number;
  origin_ref?: string;
}

export interface ConfirmSectionResponsesInput {
  question_ids: string[];
}

export const SAVE_DISCOVERY_RESPONSE_TOOL: Anthropic.Tool = {
  name: "save_discovery_response",
  description:
    "Guarda o actualiza la respuesta de un tema del discovery de ACTIIVA. Llámala cada vez que el usuario dé una respuesta real a un tema (no en cada mensaje suelto), o cuando extraigas un dato de un archivo que subió (ej. colores de un logo). NO la llames para temas que el usuario aún no ha respondido. Si el usuario corrige algo ya guardado, vuelve a llamarla con el mismo question_id y el valor nuevo — se sobreescribe.",
  input_schema: {
    type: "object",
    properties: {
      question_id: {
        type: "string",
        enum: ALL_QUESTION_IDS,
        description: "El identificador exacto del tema, tomado del mapa de temas del system prompt. No inventes ids nuevos.",
      },
      value: {
        description:
          "La forma depende del tipo de pregunta indicado en el mapa de temas: texto corto/largo -> string; opción rápida -> el 'value' exacto de la opción elegida (no el label); multi-select -> array de 'value' strings; sí/no -> boolean; tabla editable -> array de objetos con las llaves de columna indicadas (ej. [{\"name\": \"Yoga\", \"duration_minutes\": 60, \"description\": \"...\"}]); archivo subido -> array de los nombres de archivo ya subidos.",
      },
      status: {
        type: "string",
        enum: ["draft", "flagged_missing", "unknown"],
        description:
          "'draft': el usuario dio una respuesta real, pendiente de confirmar al cierre de la sección. 'flagged_missing': el usuario pidió saltarla para completar después. 'unknown': el usuario explícitamente no sabe la respuesta. Nunca uses 'owner_confirmed' aquí — eso solo lo pone confirm_section_responses.",
      },
      source: {
        type: "string",
        enum: ["user_input", "ai_extracted"],
        description:
          "'user_input': el usuario lo escribió o lo dijo directamente. 'ai_extracted': lo dedujiste tú de un archivo (ej. colores de un logo) sin que el usuario lo haya escrito literalmente — en ese caso confirma con el usuario antes o después de guardarlo.",
      },
      confidence: {
        type: "number",
        description: "Solo cuando source es 'ai_extracted': qué tan seguro estás (0 a 1). Omite este campo cuando source es 'user_input'.",
      },
      origin_ref: {
        type: "string",
        description: "Solo cuando source es 'ai_extracted': una nota breve de dónde salió el dato (ej. 'extraído del logo subido').",
      },
    },
    required: ["question_id", "value", "status", "source"],
  },
};

export const CONFIRM_SECTION_RESPONSES_TOOL: Anthropic.Tool = {
  name: "confirm_section_responses",
  description:
    "Confirma un grupo de respuestas ya guardadas como definitivas (borrador -> confirmado por el dueño). Llámala después de resumir brevemente lo que llevas de un tema o sección y el usuario lo valide ('sí, así está bien'). No confirmes respuestas que el usuario no ha visto resumidas.",
  input_schema: {
    type: "object",
    properties: {
      question_ids: {
        type: "array",
        items: { type: "string" },
        description: "Los question_id que acabas de resumir y que el usuario confirmó.",
      },
    },
    required: ["question_ids"],
  },
};

export const DISCOVERY_AGENT_TOOLS: Anthropic.Tool[] = [SAVE_DISCOVERY_RESPONSE_TOOL, CONFIRM_SECTION_RESPONSES_TOOL];
