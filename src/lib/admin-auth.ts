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

export const getAdminIdentity = cache(async (): Promise<{ email: string } | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (error || !email || !isConfiguredAdminEmail(email)) return null;
  return { email };
});

export async function requireAdmin(): Promise<{ email: string }> {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return identity;
}

export async function assertAdmin(): Promise<{ email: string }> {
  const identity = await getAdminIdentity();
  if (!identity) throw new Error("No autorizado");
  return identity;
}
