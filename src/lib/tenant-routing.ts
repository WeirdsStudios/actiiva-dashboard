const RESERVED_SUBDOMAINS = new Set(["www", "onboarding", "app", "admin", "api", "status"]);

export function isValidTenantSubdomain(candidate: string): boolean {
  return candidate.length >= 2
    && candidate.length <= 63
    && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(candidate)
    && !RESERVED_SUBDOMAINS.has(candidate);
}

export function tenantSubdomainFromHost(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.toLowerCase().split(":")[0];
  let candidate: string | null = null;
  if (hostname.endsWith(".actiiva.mx")) candidate = hostname.slice(0, -".actiiva.mx".length);
  if (hostname.endsWith(".localhost")) candidate = hostname.slice(0, -".localhost".length);
  return candidate && isValidTenantSubdomain(candidate) ? candidate : null;
}

export function tenantRewritePath(subdomain: string, pathname: string): string {
  if (
    pathname === `/sites/${subdomain}/opengraph-image` ||
    pathname === `/sites/${subdomain}/twitter-image`
  ) {
    return pathname;
  }
  const suffix = pathname === "/" ? "" : pathname;
  return `/sites/${subdomain}${suffix}`;
}

export function isTenantAuthenticatedPath(pathname: string): boolean {
  return pathname === "/mi-cuenta" || pathname.startsWith("/mi-cuenta/") || pathname === "/gestion" || pathname.startsWith("/gestion/");
}
