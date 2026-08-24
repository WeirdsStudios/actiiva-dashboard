import "server-only";

import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { questionPackActiiva } from "@/features/business-discovery-agent/packs/actiiva";
import { getLatestExports } from "@/features/business-discovery-agent/export/build-export";

export interface AdminDiscoverySessionSummary {
  id: string;
  businessName: string | null;
  status: string;
  packVersion: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  tokenExpiresAt: string;
  reopenRequestedAt: string | null;
  reopenAuthorizedUntil: string | null;
  messageCount: number;
  answeredCount: number;
  totalQuestions: number;
  organizationId: string | null;
}

export async function listAdminDiscoverySessions(): Promise<AdminDiscoverySessionSummary[]> {
  await requireAdmin();

  const { data: sessions, error } = await supabaseAdmin
    .from("discovery_sessions")
    .select(
      "id, business_name_draft, status, pack_version, tenant_id, created_at, updated_at, submitted_at, token_expires_at, reopen_requested_at, reopen_authorized_until, message_count",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las sesiones: ${error.message}`);

  const ids = (sessions ?? []).map((session) => session.id);
  const { data: responses, error: responseError } = ids.length
    ? await supabaseAdmin.from("discovery_responses").select("session_id, status").in("session_id", ids)
    : { data: [], error: null };
  if (responseError) throw new Error(`No se pudo calcular el avance: ${responseError.message}`);

  const answeredBySession = new Map<string, number>();
  for (const response of responses ?? []) {
    if (response.status !== "unanswered") {
      answeredBySession.set(response.session_id, (answeredBySession.get(response.session_id) ?? 0) + 1);
    }
  }

  return (sessions ?? []).map((session) => ({
    id: session.id,
    businessName: session.business_name_draft,
    status: session.status,
    packVersion: session.pack_version,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    submittedAt: session.submitted_at,
    tokenExpiresAt: session.token_expires_at,
    reopenRequestedAt: session.reopen_requested_at,
    reopenAuthorizedUntil: session.reopen_authorized_until,
    messageCount: session.message_count ?? 0,
    answeredCount: answeredBySession.get(session.id) ?? 0,
    totalQuestions: questionPackActiiva.questions.length,
    organizationId: session.tenant_id,
  }));
}

export async function getAdminDiscoverySession(sessionId: string) {
  await requireAdmin();

  const [{ data: session, error: sessionError }, { data: responses, error: responseError }, { data: assets, error: assetError }] =
    await Promise.all([
      supabaseAdmin
        .from("discovery_sessions")
        .select(
          "id, access_token, business_name_draft, status, pack_id, pack_version, tenant_id, created_at, updated_at, submitted_at, approved_at, token_expires_at, reopen_requested_at, reopen_authorized_until, message_count",
        )
        .eq("id", sessionId)
        .maybeSingle(),
      supabaseAdmin
        .from("discovery_responses")
        .select("question_id, section_id, value, status, source, confidence, updated_at")
        .eq("session_id", sessionId)
        .order("section_id"),
      supabaseAdmin
        .from("discovery_assets")
        .select("id, question_id, original_filename, mime_type, size_bytes, uploaded_at")
        .eq("session_id", sessionId)
        .order("uploaded_at", { ascending: false }),
    ]);

  if (sessionError) throw new Error(`No se pudo cargar la sesión: ${sessionError.message}`);
  if (responseError) throw new Error(`No se pudieron cargar las respuestas: ${responseError.message}`);
  if (assetError) throw new Error(`No se pudieron cargar los archivos: ${assetError.message}`);
  if (!session) return null;

  const latestExports = await getLatestExports(sessionId);
  const prompts = new Map(questionPackActiiva.questions.map((question) => [question.id, question.prompt]));
  const { data: organization, error: organizationError } = session.tenant_id
    ? await supabaseAdmin
        .from("organizations")
        .select("id, name, slug, status")
        .eq("id", session.tenant_id)
        .maybeSingle()
    : { data: null, error: null };
  if (organizationError) throw new Error(`No se pudo cargar el cliente vinculado: ${organizationError.message}`);

  return {
    session,
    responses: (responses ?? []).map((response) => ({
      ...response,
      prompt: prompts.get(response.question_id) ?? response.question_id,
    })),
    assets: assets ?? [],
    latestExports,
    organization,
  };
}
