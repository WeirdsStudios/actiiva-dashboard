import { redirect } from "next/navigation";

export default async function DiscoverySectionPage({
  params,
}: {
  params: Promise<{ accessToken: string; sectionSlug: string }>;
}) {
  const { accessToken } = await params;
  redirect(`/discovery/${accessToken}`);
}
