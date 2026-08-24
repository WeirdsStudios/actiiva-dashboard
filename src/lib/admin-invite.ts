export type AdminSetupSession = {
  accessToken: string;
  refreshToken: string;
  flow: "invite" | "recovery";
};

export function parseAdminSetupFragment(fragment: string): AdminSetupSession | null {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(value);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const flow = params.get("type");

  if ((flow !== "invite" && flow !== "recovery") || !accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, flow };
}
