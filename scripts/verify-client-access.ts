import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../src/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const runId = randomUUID().replaceAll("-", "");
const password = `Aa1!${randomUUID()}z`;
const createdUserIds: string[] = [];
let organizationId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createTestUser(label: string) {
  const email = `actiiva-${label}-${runId}@example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`No se pudo crear ${label}: ${error?.message ?? "sin usuario"}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function authenticatedClient(email: string) {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo autenticar ${email}: ${error.message}`);
  return client;
}

async function setAccess(userId: string, role: "owner" | "member", status: "active" | "invited", addedBy: string) {
  const { error } = await supabaseAdmin.rpc("set_organization_member_access", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role: role,
    p_status: status,
    p_added_by: addedBy,
  });
  if (error) throw new Error(`No se pudo preparar la membresía: ${error.message}`);
}

const { count: discoveryCountBefore } = await supabaseAdmin
  .from("discovery_sessions")
  .select("id", { count: "exact", head: true });

try {
  const owner = await createTestUser("owner");
  const invited = await createTestUser("invited");
  const outsider = await createTestUser("outsider");

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({ name: "ACTIIVA Access Verification", slug: `access-${runId.slice(0, 16)}`, created_by: owner.id })
    .select("id")
    .single();
  if (organizationError || !organization) throw new Error(`No se pudo crear la organización temporal: ${organizationError?.message}`);
  organizationId = organization.id;

  await setAccess(owner.id, "owner", "active", owner.id);
  await setAccess(invited.id, "member", "invited", owner.id);

  const ownerClient = await authenticatedClient(owner.email);
  const { data: ownerOrganizations } = await ownerClient.from("organizations").select("id");
  const { data: ownerMemberships } = await ownerClient.from("organization_members").select("user_id");
  assert(ownerOrganizations?.length === 1 && ownerOrganizations[0].id === organizationId, "El owner no vio exactamente su organización.");
  assert(ownerMemberships?.length === 1 && ownerMemberships[0].user_id === owner.id, "El owner pudo ver membresías ajenas.");

  const invitedClient = await authenticatedClient(invited.email);
  const { data: pendingOrganizations } = await invitedClient.from("organizations").select("id");
  const { data: pendingMemberships } = await invitedClient.from("organization_members").select("status");
  assert(pendingOrganizations?.length === 0, "Una invitación pendiente pudo ver la organización.");
  assert(pendingMemberships?.length === 1 && pendingMemberships[0].status === "invited", "El invitado no pudo ver su propia invitación.");

  const { data: activated, error: activationError } = await invitedClient.rpc("activate_own_organization_memberships");
  assert(!activationError && activated === 1, "El invitado no pudo activar su propia membresía.");
  const { data: activatedOrganizations } = await invitedClient.from("organizations").select("id");
  assert(activatedOrganizations?.length === 1 && activatedOrganizations[0].id === organizationId, "El miembro activo no obtuvo acceso.");

  const outsiderClient = await authenticatedClient(outsider.email);
  const { data: outsiderOrganizations } = await outsiderClient.from("organizations").select("id");
  const { data: outsiderMemberships } = await outsiderClient.from("organization_members").select("user_id");
  assert(outsiderOrganizations?.length === 0 && outsiderMemberships?.length === 0, "Un usuario ajeno cruzó la frontera del cliente.");

  const { error: lastOwnerError } = await supabaseAdmin.rpc("set_organization_member_access", {
    p_organization_id: organizationId,
    p_user_id: owner.id,
    p_role: "member",
    p_status: "disabled",
    p_added_by: owner.id,
  });
  assert(lastOwnerError?.message.includes("keep one active owner"), "Se pudo desactivar al último owner activo.");

  const { count: discoveryCountAfter } = await supabaseAdmin
    .from("discovery_sessions")
    .select("id", { count: "exact", head: true });
  assert(discoveryCountAfter === discoveryCountBefore, "La prueba modificó el número de sesiones discovery.");
  console.log("OK: owner, invitado, activación, outsider y último owner verificados; discovery intacto.");
} finally {
  if (organizationId) await supabaseAdmin.from("organizations").delete().eq("id", organizationId);
  for (const userId of createdUserIds) await supabaseAdmin.auth.admin.deleteUser(userId);
}
