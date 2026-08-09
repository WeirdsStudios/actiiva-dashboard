"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateDiscoveryExports } from "../export/build-export";
import type { AnswersMap, ResponseStatus } from "../engine/question-pack.types";

interface DiscoverySessionRow {
  id: string;
  access_token: string;
  token_expires_at: string;
  pack_id: string;
  pack_version: string;
  status: string;
  current_section_id: string | null;
}

export type SessionLookupResult =
  | { state: "not_found" }
  | { state: "expired" }
  | { state: "ok"; session: DiscoverySessionRow; answers: AnswersMap };

export async function getSessionByAccessToken(accessToken: string): Promise<SessionLookupResult> {
  const { data: session, error } = await supabaseAdmin
    .from("discovery_sessions")
    .select("id, access_token, token_expires_at, pack_id, pack_version, status, current_section_id")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error || !session) return { state: "not_found" };
  if (new Date(session.token_expires_at) < new Date()) return { state: "expired" };

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
  questionId: string;
  sectionId: string;
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
  const { sessionId, questionId, sectionId, value, status, source, confidence, originRef } = params;

  const { error } = await supabaseAdmin.from("discovery_responses").upsert(
    {
      session_id: sessionId,
      question_id: questionId,
      section_id: sectionId,
      value: value ?? null,
      status,
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
  questionIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
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
export async function updateBusinessNameDraft(sessionId: string, name: string): Promise<void> {
  await supabaseAdmin.from("discovery_sessions").update({ business_name_draft: name }).eq("id", sessionId);
}

// El agente llama a esto (vía el tool close_discovery_session) solo después
// de resumir y que el dueño del negocio confirme explícitamente que ya está
// todo — ver system-prompt.ts § CLOSING_GUIDE.
export async function closeDiscoverySession(sessionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
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

  const { error } = await supabaseAdmin
    .from("discovery_sessions")
    .update({ status: "submitted", submitted_at: submittedAt })
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
export async function reopenDiscoverySessionIfSubmitted(sessionId: string): Promise<void> {
  await supabaseAdmin
    .from("discovery_sessions")
    .update({ status: "in_progress" })
    .eq("id", sessionId)
    .eq("status", "submitted");
}

export async function setSessionCurrentSection(sessionId: string, sectionId: string): Promise<void> {
  await supabaseAdmin
    .from("discovery_sessions")
    .update({ current_section_id: sectionId })
    .eq("id", sessionId);
}

export async function uploadDiscoveryAsset(
  sessionId: string,
  questionId: string,
  formData: FormData,
): Promise<{ ok: true; asset: { filename: string; path: string } } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No se recibió el archivo" };

  const path = `${sessionId}/${questionId}/${Date.now()}-${file.name}`;

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
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, asset: { filename: file.name, path } };
}

// Fase 2 no incluye el panel interno para crear sesiones (eso es Fase 5).
// Esta función existe solo para poder probar el flujo de punta a punta mientras tanto.
export async function createDiscoverySession(packId: string, packVersion: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("discovery_sessions")
    .insert({ pack_id: packId, pack_version: packVersion })
    .select("access_token")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la sesión");
  return data.access_token as string;
}
