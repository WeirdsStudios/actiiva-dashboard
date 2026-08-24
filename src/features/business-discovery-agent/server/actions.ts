"use server";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateDiscoveryExports } from "../export/build-export";
import type { AnswersMap, ResponseStatus } from "../engine/question-pack.types";
import { questionPackActiiva } from "../packs/actiiva";
import { accessErrorMessage, authorizeDiscoverySession } from "./access-control";
import { ADJUSTMENT_WINDOW_DAYS, computeSessionLockState } from "./session-lock";
import { validateDiscoveryFile, validateDiscoveryResponse } from "./response-validation";
import { validateImageSignature } from "./content-safety";

interface DiscoverySessionRow {
  id: string;
  access_token: string;
  token_expires_at: string;
  pack_id: string;
  pack_version: string;
  status: string;
  current_section_id: string | null;
  // Usados por session-lock.ts para decidir si el chat sigue accesible tras
  // la ventana de 20 días — ver page.tsx, que llama a computeSessionLockState
  // con estos tres campos.
  submitted_at: string | null;
  reopen_requested_at: string | null;
  reopen_authorized_until: string | null;
}

export type SessionLookupResult =
  | { state: "not_found" }
  | { state: "expired"; session: DiscoverySessionRow }
  | { state: "ok"; session: DiscoverySessionRow; answers: AnswersMap };

export async function getSessionByAccessToken(accessToken: string): Promise<SessionLookupResult> {
  const { data: session, error } = await supabaseAdmin
    .from("discovery_sessions")
    .select(
      "id, access_token, token_expires_at, pack_id, pack_version, status, current_section_id, submitted_at, reopen_requested_at, reopen_authorized_until",
    )
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error || !session) return { state: "not_found" };
  if (new Date(session.token_expires_at) < new Date()) return { state: "expired", session };

  const { data: responses } = await supabaseAdmin
    .from("discovery_responses")
    .select("question_id, value, status")
    .eq("session_id", session.id);

  const answers: AnswersMap = {};
  for (const row of responses ?? []) {
    answers[row.question_id] = { value: row.value, status: row.status as ResponseStatus };
  }

  return { state: "ok", session, answers };
}

export async function saveResponse(params: {
  sessionId: string;
  accessToken: string;
  questionId: string;
  value: unknown;
  status: ResponseStatus;
  // Opcionales, agregados para el agente de IA (ver
  // docs/business-discovery-agent/AI-AGENT-DESIGN.md). Los callers existentes
  // (DiscoverySectionScreen) no los pasan, así que no cambian de
  // comportamiento: al no incluirse en el payload del upsert, la columna
  // simplemente no se toca (mantiene su default en insert, su valor previo
  // en update).
  source?: "user_input" | "ai_extracted" | "inferred" | "default";
  confidence?: number;
  originRef?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { sessionId, accessToken, questionId, value, status, source, confidence, originRef } = params;
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return { ok: false, error: accessErrorMessage(access.reason) };

  const allowedSources = new Set(["user_input", "ai_extracted", "inferred", "default"]);
  if (source !== undefined && !allowedSources.has(source)) {
    return { ok: false, error: "La procedencia de la respuesta no es válida." };
  }
  if (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    return { ok: false, error: "La confianza debe estar entre 0 y 1." };
  }
  if (originRef !== undefined && originRef.length > 500) {
    return { ok: false, error: "La referencia de origen es demasiado larga." };
  }

  const validated = validateDiscoveryResponse({ questionId, value, status });
  if (!validated.ok) return validated;

  const { error } = await supabaseAdmin.from("discovery_responses").upsert(
    {
      session_id: sessionId,
      question_id: questionId,
      section_id: validated.data.question.sectionId,
      value: validated.data.value,
      status: validated.data.status,
      ...(source !== undefined ? { source } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      ...(originRef !== undefined ? { origin_ref: originRef } : {}),
    },
    { onConflict: "session_id,question_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function confirmDraftResponses(
  sessionId: string,
  accessToken: string,
  questionIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return { ok: false, error: accessErrorMessage(access.reason) };

  const knownIds = new Set(questionPackActiiva.questions.map((question) => question.id));
  if (questionIds.length > questionPackActiiva.questions.length || questionIds.some((id) => !knownIds.has(id))) {
    return { ok: false, error: "Una o más respuestas no pertenecen al pack activo." };
  }
  if (questionIds.length === 0) return { ok: true };

  const { error } = await supabaseAdmin
    .from("discovery_responses")
    .update({ status: "owner_confirmed" satisfies ResponseStatus })
    .eq("session_id", sessionId)
    .eq("status", "draft" satisfies ResponseStatus)
    .in("question_id", questionIds);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Backfill para que la sesión quede identificable (header del chat, futuro
// panel admin) sin exigirle a quien crea el link que teclee el nombre del
// negocio de antemano — el agente ya lo pregunta como su primer tema real
// (biz.name); en cuanto lo guarda, ai/agent-loop.ts llama a esta función.
export async function updateBusinessNameDraft(sessionId: string, accessToken: string, name: string): Promise<void> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return;
  const normalizedName = name.trim().slice(0, 120);
  if (!normalizedName) return;
  await supabaseAdmin.from("discovery_sessions").update({ business_name_draft: normalizedName }).eq("id", sessionId);
}

// El agente llama a esto (vía el tool close_discovery_session) solo después
// de resumir y que el dueño del negocio confirme explícitamente que ya está
// todo — ver system-prompt.ts § CLOSING_GUIDE.
export async function closeDiscoverySession(
  sessionId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return { ok: false, error: accessErrorMessage(access.reason) };

  const { data: current } = await supabaseAdmin
    .from("discovery_sessions")
    .select("submitted_at")
    .eq("id", sessionId)
    .maybeSingle();

  // submitted_at solo se pone la primera vez — es el ancla fija de la
  // ventana de 20 días para ajustes (ver export/build-export.ts). Si el
  // negocio reabre y vuelve a cerrar después de corregir algo, la fecha no
  // se mueve.
  const submittedAt = current?.submitted_at ?? new Date().toISOString();
  const adjustmentDeadline = new Date(
    new Date(submittedAt).getTime() + ADJUSTMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const tokenExpiresAt =
    new Date(access.session.token_expires_at).getTime() > new Date(adjustmentDeadline).getTime()
      ? access.session.token_expires_at
      : adjustmentDeadline;

  const { error } = await supabaseAdmin
    .from("discovery_sessions")
    .update({ status: "submitted", submitted_at: submittedAt, token_expires_at: tokenExpiresAt })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };

  try {
    // Se regenera completo en cada cierre (incluye recierres tras una
    // corrección) — no bloquea el cierre de la conversación con el usuario
    // si falla: ya se guardó el status, la exportación se puede regenerar
    // después.
    await generateDiscoveryExports(sessionId, submittedAt);
  } catch (exportError) {
    console.error("No se pudo generar la exportación de discovery:", exportError);
  }

  return { ok: true };
}

// Permite reabrir: si el dueño del negocio vuelve a escribir en una sesión ya
// cerrada (mismo link, cualquier momento), la regresa a 'in_progress' antes
// de procesar el mensaje — no hay ninguna pantalla ni confirmación de por
// medio, simplemente sigue funcionando. El .eq("status", "submitted") hace
// que sea un no-op seguro si la sesión ya estaba abierta.
export async function reopenDiscoverySessionIfSubmitted(sessionId: string, accessToken: string): Promise<void> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return;
  await supabaseAdmin
    .from("discovery_sessions")
    .update({ status: "in_progress" })
    .eq("id", sessionId)
    .eq("status", "submitted");
}

// El botón "Solicitar reapertura" de DiscoverySessionLockedScreen.tsx llama
// a esto (vía server/chat-actions.ts) cuando ya pasó la ventana de 20 días.
// No desbloquea nada por sí solo — solo registra la solicitud para que el
// dueño del proyecto la vea (scripts/list-reopen-requests.ts) y decida si
// autoriza (scripts/authorize-reopen.ts, que es lo único que en verdad
// desbloquea, escribiendo reopen_authorized_until).
export async function requestSessionReopen(
  sessionId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await authorizeDiscoverySession(sessionId, accessToken, { allowExpired: true, allowLocked: true });
  if (!access.ok) return { ok: false, error: accessErrorMessage(access.reason) };
  if (access.session.status === "approved") {
    return { ok: false, error: "Esta sesión ya fue aprobada y no admite reapertura desde el enlace público." };
  }
  if (!computeSessionLockState(access.session).locked) {
    return { ok: false, error: "Esta sesión todavía no requiere una reapertura." };
  }

  const { error } = await supabaseAdmin
    .from("discovery_sessions")
    .update({ reopen_requested_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setSessionCurrentSection(sessionId: string, accessToken: string, sectionId: string): Promise<void> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return;
  if (!questionPackActiiva.sections.some((section) => section.id === sectionId)) return;
  await supabaseAdmin
    .from("discovery_sessions")
    .update({ current_section_id: sectionId })
    .eq("id", sessionId);
}

export async function uploadDiscoveryAsset(
  sessionId: string,
  accessToken: string,
  questionId: string,
  formData: FormData,
): Promise<{ ok: true; asset: { filename: string; path: string } } | { ok: false; error: string }> {
  const access = await authorizeDiscoverySession(sessionId, accessToken);
  if (!access.ok) return { ok: false, error: accessErrorMessage(access.reason) };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No se recibió el archivo" };
  const validation = validateDiscoveryFile(questionId, file);
  if (!validation.ok) return validation;
  const signatureValidation = await validateImageSignature(file);
  if (!signatureValidation.ok) return signatureValidation;

  const { count, error: countError } = await supabaseAdmin
    .from("discovery_assets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("question_id", questionId);
  if (countError) return { ok: false, error: "No se pudo validar el límite de archivos." };
  if ((count ?? 0) >= validation.question.fileConstraint!.maxFiles) {
    return { ok: false, error: `Ya alcanzaste el máximo de ${validation.question.fileConstraint!.maxFiles} archivos.` };
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "archivo";
  const path = `${sessionId}/${questionId}/${randomUUID()}-${safeFilename}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("discovery-assets")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: insertError } = await supabaseAdmin.from("discovery_assets").insert({
    session_id: sessionId,
    question_id: questionId,
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (insertError) {
    await supabaseAdmin.storage.from("discovery-assets").remove([path]);
    return { ok: false, error: insertError.message };
  }

  return { ok: true, asset: { filename: file.name, path } };
}
