import { supabaseAdmin } from "@/lib/supabase-admin";
import { questionPackActiiva } from "../packs/actiiva";
import { isQuestionVisible } from "../engine/session-runtime";
import type { AnswersMap, ResponseStatus } from "../engine/question-pack.types";

// El negocio puede reabrir su sesión y corregir datos después de "terminar"
// (decisión del dueño del proyecto, 09-ago-2026) — así que la exportación NO
// es un snapshot único: se regenera completa cada vez que se cierra la
// sesión (server/actions.ts, closeDiscoverySession), incluyendo recierres
// después de una corrección. Las filas viejas de discovery_exports no se
// borran (quedan como historial/auditoría) — el consumidor debe leer el
// generated_at más reciente por sesión (ver getLatestExports abajo).
//
// Ventana de 20 días: el negocio tiene 20 días desde su PRIMER cierre para
// seguir ajustando antes de que el proceso de construcción tome los datos
// como definitivos. Por eso closeDiscoverySession solo pone submitted_at la
// primera vez — es el ancla fija de esa ventana, no se mueve aunque el
// negocio reabra y vuelva a cerrar después.
const ADJUSTMENT_WINDOW_DAYS = 20;

// question_id -> dataTarget ("documento.campo"), tomado del pack real — una
// sola fuente de verdad, igual que build-topic-map.ts. Si se agrega una
// pregunta nueva con un dataTarget nuevo, el exportador la recoge sola sin
// tocar este archivo.
const QUESTION_ID_TO_DATA_TARGET = new Map(questionPackActiiva.questions.map((q) => [q.id, q.dataTarget]));

function splitDataTarget(dataTarget: string): { document: string; field: string } {
  const dotIndex = dataTarget.indexOf(".");
  return { document: dataTarget.slice(0, dotIndex), field: dataTarget.slice(dotIndex + 1) };
}

interface DiscoveryResponseRow {
  question_id: string;
  value: unknown;
  status: ResponseStatus;
}

interface MissingItem {
  questionId: string;
  prompt: string;
  reason: "flagged_missing" | "unknown" | "sin_responder";
}

async function loadAnswers(sessionId: string): Promise<{ rows: DiscoveryResponseRow[]; answers: AnswersMap }> {
  const { data, error } = await supabaseAdmin
    .from("discovery_responses")
    .select("question_id, value, status")
    .eq("session_id", sessionId);

  if (error) throw new Error(`No se pudieron leer las respuestas de la sesión: ${error.message}`);

  const rows = (data ?? []) as DiscoveryResponseRow[];
  const answers: AnswersMap = {};
  for (const row of rows) answers[row.question_id] = { value: row.value, status: row.status };

  return { rows, answers };
}

// Agrupa discovery_responses por el prefijo de dataTarget -> uno de los 7
// documentos "mecánicos" definidos en docs/business-discovery-agent/DATA_MODEL.md
// §4 (business-profile, brand-profile, offerings, schedules, team,
// asset-manifest, website-content). Pura reagrupación, sin juicio de
// negocio — por diseño, para que nunca se desincronice del pack.
function groupByDocument(rows: DiscoveryResponseRow[]): Record<string, Record<string, unknown>> {
  const documents: Record<string, Record<string, unknown>> = {};

  for (const row of rows) {
    if (row.status === "unanswered") continue;
    const dataTarget = QUESTION_ID_TO_DATA_TARGET.get(row.question_id);
    if (!dataTarget) continue; // pregunta que ya no existe en el pack actual

    const { document, field } = splitDataTarget(dataTarget);
    documents[document] ??= {};
    documents[document][field] = row.value;
  }

  return documents;
}

// missing-information.json: obligatorias sin responder (que sí apliquen
// según sus condiciones — reusa isQuestionVisible, misma lógica que ya usa
// el motor determinista) + cualquier cosa marcada flagged_missing/unknown.
function computeMissingBySection(answers: AnswersMap): Record<string, MissingItem[]> {
  const missingBySection: Record<string, MissingItem[]> = {};

  for (const q of questionPackActiiva.questions) {
    if (!isQuestionVisible(q, answers)) continue;

    const answer = answers[q.id];
    const status = answer?.status;
    let reason: MissingItem["reason"] | null = null;

    if (status === "flagged_missing" || status === "unknown") reason = status;
    else if (q.required && (!answer || status === "unanswered")) reason = "sin_responder";

    if (reason) {
      missingBySection[q.sectionId] ??= [];
      missingBySection[q.sectionId].push({ questionId: q.id, prompt: q.prompt, reason });
    }
  }

  return missingBySection;
}

function buildWebsiteContentMarkdown(documents: Record<string, Record<string, unknown>>): string {
  const tagline = (documents["website-content"]?.tagline as string | undefined) || "_(no proporcionada)_";
  const testimonial = (documents["website-content"]?.testimonial as string | undefined) || "_(no proporcionado)_";

  return [
    "# Contenido para el sitio web",
    "",
    "## Frase principal",
    tagline,
    "",
    "## Testimonio destacado",
    testimonial,
  ].join("\n");
}

function buildImplementationBrief(
  businessLabel: string,
  answers: AnswersMap,
  missingBySection: Record<string, MissingItem[]>,
): string {
  const applicableQuestions = questionPackActiiva.questions.filter((q) => isQuestionVisible(q, answers));
  const answeredCount = applicableQuestions.filter((q) => {
    const status = answers[q.id]?.status;
    return status && status !== "unanswered";
  }).length;

  const missingLines = Object.entries(missingBySection).flatMap(([sectionId, items]) =>
    items.map((item) => `- [${sectionId}] ${item.prompt} (${item.reason})`),
  );

  return [
    `# Brief de implementación — ${businessLabel}`,
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "## Cobertura",
    `${answeredCount}/${applicableQuestions.length} preguntas aplicables respondidas.`,
    "",
    "## Pendientes de seguimiento manual",
    missingLines.length > 0 ? missingLines.join("\n") : "Ninguno — todo lo obligatorio aplicable está cubierto.",
  ].join("\n");
}

export interface GeneratedExportDocument {
  documentName: string;
  content: unknown;
}

async function computeExportDocuments(sessionId: string, submittedAt: string): Promise<GeneratedExportDocument[]> {
  const { rows, answers } = await loadAnswers(sessionId);
  const documents = groupByDocument(rows);
  const missingBySection = computeMissingBySection(answers);

  const businessLabel = (documents["business-profile"]?.name as string | undefined) || "este negocio";

  const adjustmentDeadlineAt = new Date(
    new Date(submittedAt).getTime() + ADJUSTMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const mechanicalDocs: GeneratedExportDocument[] = Object.entries(documents).map(([documentName, content]) => ({
    documentName: `${documentName}.json`,
    content,
  }));

  return [
    ...mechanicalDocs,
    { documentName: "missing-information.json", content: { bySection: missingBySection } },
    {
      documentName: "tenant-seed.json",
      content: {
        businessName: documents["business-profile"]?.name ?? null,
        businessType: documents["business-profile"]?.businessType ?? null,
        contactPhone: documents["business-profile"]?.phone ?? null,
        address: documents["business-profile"]?.address ?? null,
        submittedAt,
        adjustmentDeadlineAt,
      },
    },
    { documentName: "website-content.md", content: { markdown: buildWebsiteContentMarkdown(documents) } },
    {
      documentName: "implementation-brief.md",
      content: { markdown: buildImplementationBrief(businessLabel, answers, missingBySection) },
    },
  ];
}

// Se llama desde closeDiscoverySession — regenera completo cada vez (nunca
// hace update parcial), y nunca borra generaciones previas de la misma
// sesión: quedan como historial. Requiere que submitted_at ya esté puesto
// (closeDiscoverySession lo garantiza antes de llamar esto).
export async function generateDiscoveryExports(sessionId: string, submittedAt: string): Promise<void> {
  const documents = await computeExportDocuments(sessionId, submittedAt);
  const generatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin.from("discovery_exports").insert(
    documents.map((doc) => ({
      session_id: sessionId,
      document_name: doc.documentName,
      content: doc.content,
      generated_at: generatedAt,
    })),
  );

  if (error) throw new Error(`No se pudieron guardar los documentos de exportación: ${error.message}`);
}

// Lo que el proceso de construcción (u otro consumidor) debe usar para leer
// siempre la versión más reciente: todas las filas comparten el mismo
// generated_at dentro de una misma generación, así que basta con el máximo
// por sesión — sin necesidad de una columna "is_latest" ni de borrar
// historial.
export async function getLatestExports(
  sessionId: string,
): Promise<{ generatedAt: string; documents: GeneratedExportDocument[] } | null> {
  const { data: latest } = await supabaseAdmin
    .from("discovery_exports")
    .select("generated_at")
    .eq("session_id", sessionId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return null;

  const { data, error } = await supabaseAdmin
    .from("discovery_exports")
    .select("document_name, content")
    .eq("session_id", sessionId)
    .eq("generated_at", latest.generated_at);

  if (error) throw new Error(`No se pudieron leer los documentos de exportación: ${error.message}`);

  return {
    generatedAt: latest.generated_at,
    documents: (data ?? []).map((row) => ({ documentName: row.document_name, content: row.content })),
  };
}
