import { describe, expect, test } from "bun:test";
import { isTenantAuthenticatedPath, isValidTenantSubdomain, tenantRewritePath, tenantSubdomainFromHost } from "./tenant-routing";

describe("tenant routing", () => {
  test("recognizes valid tenant subdomains without a code allowlist", () => {
    expect(tenantSubdomainFromHost("mexgym.actiiva.mx")).toBe("mexgym");
    expect(tenantSubdomainFromHost("mexgym.localhost:3000")).toBe("mexgym");
    expect(tenantSubdomainFromHost("onboarding.actiiva.mx")).toBeNull();
    expect(tenantSubdomainFromHost("studiofit.actiiva.mx")).toBe("studiofit");
    expect(tenantSubdomainFromHost("bad_name.actiiva.mx")).toBeNull();
  });

  test("validates tenant names before provisioning", () => {
    expect(isValidTenantSubdomain("studiofit")).toBe(true);
    expect(isValidTenantSubdomain("studio-fit-2")).toBe(true);
    expect(isValidTenantSubdomain("onboarding")).toBe(false);
    expect(isValidTenantSubdomain("StudioFit")).toBe(false);
  });

  test("rewrites while preserving the visible path", () => {
    expect(tenantRewritePath("mexgym", "/")).toBe("/sites/mexgym");
    expect(tenantRewritePath("mexgym", "/gestion")).toBe("/sites/mexgym/gestion");
    expect(tenantRewritePath("mexgym", "/sites/mexgym/opengraph-image")).toBe(
      "/sites/mexgym/opengraph-image",
    );
    expect(tenantRewritePath("mexgym", "/sites/mexgym/twitter-image")).toBe(
      "/sites/mexgym/twitter-image",
    );
  });

  test("refreshes auth only for member and management surfaces", () => {
    expect(isTenantAuthenticatedPath("/mi-cuenta")).toBeTrue();
    expect(isTenantAuthenticatedPath("/gestion/entrar")).toBeTrue();
    expect(isTenantAuthenticatedPath("/planes")).toBeFalse();
  });
});
