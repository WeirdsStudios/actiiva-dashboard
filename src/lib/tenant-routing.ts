const TENANT_SUBDOMAINS = new Set(["mexgym"]);

export function tenantSubdomainFromHost(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.toLowerCase().split(":")[0];
  let candidate: string | null = null;
  if (hostname.endsWith(".actiiva.mx")) candidate = hostname.slice(0, -".actiiva.mx".length);
  if (hostname.endsWith(".localhost")) candidate = hostname.slice(0, -".localhost".length);
  return candidate && TENANT_SUBDOMAINS.has(candidate) ? candidate : null;
}

export function tenantRewritePath(subdomain: string, pathname: string): string {
  const suffix = pathname === "/" ? "" : pathname;
  return `/sites/${subdomain}${suffix}`;
}

export function isTenantAuthenticatedPath(pathname: string): boolean {
  return pathname === "/mi-cuenta" || pathname.startsWith("/mi-cuenta/") || pathname === "/gestion" || pathname.startsWith("/gestion/");
}
