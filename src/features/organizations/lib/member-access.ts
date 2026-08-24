export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
export const ORGANIZATION_MEMBER_STATUSES = ["invited", "active", "disabled"] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type OrganizationMemberStatus = (typeof ORGANIZATION_MEMBER_STATUSES)[number];

export function normalizeMemberEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function parseOrganizationRole(value: unknown): OrganizationRole | null {
  return typeof value === "string" && ORGANIZATION_ROLES.includes(value as OrganizationRole)
    ? (value as OrganizationRole)
    : null;
}

export function parseOrganizationMemberStatus(value: unknown): OrganizationMemberStatus | null {
  return typeof value === "string" && ORGANIZATION_MEMBER_STATUSES.includes(value as OrganizationMemberStatus)
    ? (value as OrganizationMemberStatus)
    : null;
}
