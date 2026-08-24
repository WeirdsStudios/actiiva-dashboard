import { GymAccessScreen } from "@/features/gym-platform/ui/GymAccessScreen";

export default async function GymMemberLoginPage({ params, searchParams }: { params: Promise<{ siteSubdomain: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ siteSubdomain }, query] = await Promise.all([params, searchParams]);
  return <GymAccessScreen subdomain={siteSubdomain} mode="member" accessError={query.error === "access"} />;
}
