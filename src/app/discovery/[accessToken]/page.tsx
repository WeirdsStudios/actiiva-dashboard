import { questionPackActiiva } from "@/features/business-discovery-agent/packs/actiiva";
import { getSessionByAccessToken } from "@/features/business-discovery-agent/server/actions";
import { getBusinessNameDraft, getChatHistory } from "@/features/business-discovery-agent/server/chat-actions";
import { DiscoveryChatScreen } from "@/features/business-discovery-agent/ui/DiscoveryChatScreen";
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
