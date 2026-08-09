import { questionPackActiiva } from "@/features/business-discovery-agent/packs/actiiva";
import { getSessionByAccessToken } from "@/features/business-discovery-agent/server/actions";
import { getBusinessNameDraft, getChatHistory } from "@/features/business-discovery-agent/server/chat-actions";
import { computeSessionLockState } from "@/features/business-discovery-agent/server/session-lock";
import { DiscoveryChatScreen } from "@/features/business-discovery-agent/ui/DiscoveryChatScreen";
import { DiscoverySessionLockedScreen } from "@/features/business-discovery-agent/ui/DiscoverySessionLockedScreen";
import { SessionUnavailable } from "@/features/business-discovery-agent/ui/SessionUnavailable";

// Pivote a agente de IA (ver docs/business-discovery-agent/AI-AGENT-DESIGN.md):
// esta pantalla ya no redirige a la primera sección del flujo determinista
// (/discovery/[accessToken]/[sectionSlug]) — el chat es la entrada única.
export default async function DiscoveryEntryPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const result = await getSessionByAccessToken(accessToken);

  if (result.state === "not_found") return <SessionUnavailable reason="not_found" />;
  if (result.state === "expired") return <SessionUnavailable reason="expired" />;

  // Bloqueo tras la ventana de 20 días desde el primer cierre (decisión del
  // dueño del proyecto, 09-ago-2026) — se evalúa aquí, antes de renderizar
  // el chat. sendChatMessage también lo revisa por su cuenta como defensa en
  // profundidad, ver server/chat-actions.ts.
  const lockState = computeSessionLockState(result.session);
  if (lockState.locked) {
    return <DiscoverySessionLockedScreen sessionId={result.session.id} alreadyRequested={lockState.reopenRequested} />;
  }

  const fileUploadQuestions = questionPackActiiva.questions.filter((q) => q.type === "file_upload");
  const [initialHistory, businessNameDraft] = await Promise.all([
    getChatHistory(result.session.id),
    getBusinessNameDraft(result.session.id),
  ]);

  return (
    <DiscoveryChatScreen
      sessionId={result.session.id}
      businessNameDraft={businessNameDraft}
      fileUploadQuestions={fileUploadQuestions}
      initialHistory={initialHistory}
    />
  );
}
