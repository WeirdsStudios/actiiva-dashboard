import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase-proxy";
import { isTenantAuthenticatedPath, tenantRewritePath, tenantSubdomainFromHost } from "@/lib/tenant-routing";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const tenantSubdomain = tenantSubdomainFromHost(request.headers.get("host"));
  if (tenantSubdomain) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = tenantRewritePath(tenantSubdomain, pathname);
    if (rewriteUrl.pathname === pathname) return NextResponse.next();
    if (isTenantAuthenticatedPath(pathname)) return refreshSupabaseSession(request, rewriteUrl);
    return NextResponse.rewrite(rewriteUrl);
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/portal")) return refreshSupabaseSession(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
