import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isConfiguredAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

export interface AdminIdentity {
  userId: string;
  email: string;
}

export const getAdminIdentity = cache(async (): Promise<AdminIdentity | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !email || !userId || !isConfiguredAdminEmail(email)) return null;
  return { userId, email };
});

export async function requireAdmin(): Promise<AdminIdentity> {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return identity;
}

export async function assertAdmin(): Promise<AdminIdentity> {
  const identity = await getAdminIdentity();
  if (!identity) throw new Error("No autorizado");
  return identity;
}
