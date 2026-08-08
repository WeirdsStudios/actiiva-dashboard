import { notFound } from "next/navigation";
import { questionPackActiiva } from "@/features/business-discovery-agent/packs/actiiva";
import { DiscoverySectionScreen } from "@/features/business-discovery-agent/ui/DiscoverySectionScreen";
import { SessionUnavailable } from "@/features/business-discovery-agent/ui/SessionUnavailable";
import { getSessionByAccessToken, setSessionCurrentSection } from "@/features/business-discovery-agent/server/actions";

export default async function DiscoverySectionPage({
  params,
}: {
  params: Promise<{ accessToken: string; sectionSlug: string }>;
}) {
  const { accessToken, sectionSlug } = await params;

  const sectionExists = questionPackActiiva.sections.some((s) => s.id === sectionSlug);
  if (!sectionExists) notFound();

  const result = await getSessionByAccessToken(accessToken);
  if (result.state === "not_found") return <SessionUnavailable reason="not_found" />;
  if (result.state === "expired") return <SessionUnavailable reason="expired" />;

  if (result.session.current_section_id !== sectionSlug) {
    await setSessionCurrentSection(result.session.id, sectionSlug);
  }

  return (
    <DiscoverySectionScreen
      pack={questionPackActiiva}
      sectionId={sectionSlug}
      sessionId={result.session.id}
      initialAnswers={result.answers}
    />
  );
}
