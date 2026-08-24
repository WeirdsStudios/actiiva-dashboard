import { describe, expect, test } from "bun:test";
import { normalizeMemberEmail, parseOrganizationMemberStatus, parseOrganizationRole } from "./member-access";

describe("organization member access input", () => {
  test("normalizes a valid email", () => {
    expect(normalizeMemberEmail("  OWNER@Example.com ")).toBe("owner@example.com");
  });

  test("rejects malformed or oversized emails", () => {
    expect(normalizeMemberEmail("not-an-email")).toBeNull();
    expect(normalizeMemberEmail(`${"a".repeat(250)}@x.mx`)).toBeNull();
  });

  test("accepts only supported roles and statuses", () => {
    expect(parseOrganizationRole("owner")).toBe("owner");
    expect(parseOrganizationRole("superadmin")).toBeNull();
    expect(parseOrganizationMemberStatus("disabled")).toBe("disabled");
    expect(parseOrganizationMemberStatus("deleted")).toBeNull();
  });
});
