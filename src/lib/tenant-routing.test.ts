import { describe, expect, test } from "bun:test";
import { isTenantAuthenticatedPath, tenantRewritePath, tenantSubdomainFromHost } from "./tenant-routing";

describe("tenant routing", () => {
  test("recognizes only configured production and local subdomains", () => {
    expect(tenantSubdomainFromHost("mexgym.actiiva.mx")).toBe("mexgym");
    expect(tenantSubdomainFromHost("mexgym.localhost:3000")).toBe("mexgym");
    expect(tenantSubdomainFromHost("onboarding.actiiva.mx")).toBeNull();
    expect(tenantSubdomainFromHost("attacker.actiiva.mx")).toBeNull();
  });

  test("rewrites while preserving the visible path", () => {
    expect(tenantRewritePath("mexgym", "/")).toBe("/sites/mexgym");
    expect(tenantRewritePath("mexgym", "/gestion")).toBe("/sites/mexgym/gestion");
  });

  test("refreshes auth only for member and management surfaces", () => {
    expect(isTenantAuthenticatedPath("/mi-cuenta")).toBeTrue();
    expect(isTenantAuthenticatedPath("/gestion/entrar")).toBeTrue();
    expect(isTenantAuthenticatedPath("/planes")).toBeFalse();
  });
});
