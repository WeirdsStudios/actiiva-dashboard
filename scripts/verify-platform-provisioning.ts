import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../src/lib/supabase-admin";

const actorEmail = process.argv[2]?.trim().toLowerCase();
if (!actorEmail) throw new Error("Uso: bun run scripts/verify-platform-provisioning.ts <correo-admin>");

const runId = randomUUID().replaceAll("-", "").slice(0, 10);
const businessName = `Provisioning Verify ${runId}`;
const slug = `verify-${runId}`;
let organizationId: string | null = null;
let sessionId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const actor = users.users.find((user) => user.email?.toLowerCase() === actorEmail);
if (!actor) throw new Error(`No existe el usuario ${actorEmail}`);

try {
  const { data: session, error: sessionError } = await supabaseAdmin.from("discovery_sessions").insert({
    pack_id: "question-pack-actiiva",
    pack_version: "0.2.0",
    business_name_draft: businessName,
    status: "approved",
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
  }).select("id").single();
  if (sessionError || !session) throw sessionError ?? new Error("No se creó la sesión temporal");
  sessionId = session.id;

  const { data: createdOrganizationId, error: conversionError } = await supabaseAdmin.rpc("convert_discovery_session_to_organization", {
    p_session_id: sessionId,
    p_name: businessName,
    p_slug: slug,
    p_created_by: actor.id,
  });
  if (conversionError || typeof createdOrganizationId !== "string") throw conversionError ?? new Error("No se creó la organización temporal");
  organizationId = createdOrganizationId;

  const payload = {
    p_organization_id: organizationId,
    p_source_session_id: sessionId,
    p_subdomain: slug,
    p_site_name: businessName,
    p_tagline: "Una plataforma temporal para verificar publicación.",
    p_description: "Prueba automatizada del flujo de onboarding a plataforma.",
    p_address: "Dirección temporal",
    p_phone: "5500000000",
    p_primary_color: "#20252B",
    p_accent_color: "#FF6B4A",
    p_plans: [{
      slug: "mensual-1", name: "Mensual", description: "", priceCents: 90000,
      billingPeriod: "month", durationCount: 1, durationUnit: "month",
      classAccess: "unlimited", classCredits: null, published: true,
    }],
    p_classes: [{
      slug: "movilidad-0700", name: "Movilidad", coach: "Equipo temporal",
      weekdays: [1, 3], startTime: "07:00", durationMinutes: 50,
      capacity: 12, intensity: "medium", published: true,
    }],
    p_drop_in_price_cents: 18000,
    p_actor_id: actor.id,
  };

  const { data: firstProvision, error: firstProvisionError } = await supabaseAdmin.rpc("provision_organization_gym_platform", payload);
  if (firstProvisionError) throw firstProvisionError;
  assert(firstProvision?.created === true && firstProvision?.status === "draft", "La primera preparación no creó un borrador.");
  const { data: secondProvision, error: secondProvisionError } = await supabaseAdmin.rpc("provision_organization_gym_platform", payload);
  if (secondProvisionError) throw secondProvisionError;
  assert(secondProvision?.created === false, "El reintento creó una plataforma duplicada.");

  const [{ count: siteCount }, { count: branchCount }, { count: planCount }, { count: classCount }, { count: catalogCount }] = await Promise.all([
    supabaseAdmin.from("organization_sites").select("organization_id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("gym_branches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("gym_membership_plans").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("gym_classes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("gym_catalog_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);
  assert(siteCount === 1 && branchCount === 1 && planCount === 1 && classCount === 1 && catalogCount === 2, "La preparación atómica quedó incompleta.");

  const { error: prematurePublishError } = await supabaseAdmin.rpc("publish_organization_gym_platform", {
    p_organization_id: organizationId,
    p_actor_id: actor.id,
  });
  assert(prematurePublishError?.message.includes("active owner"), "La publicación no bloqueó la ausencia de propietario.");

  const { error: ownerError } = await supabaseAdmin.rpc("set_organization_member_access", {
    p_organization_id: organizationId,
    p_user_id: actor.id,
    p_role: "owner",
    p_status: "active",
    p_added_by: actor.id,
  });
  if (ownerError) throw ownerError;
  const { data: publication, error: publicationError } = await supabaseAdmin.rpc("publish_organization_gym_platform", {
    p_organization_id: organizationId,
    p_actor_id: actor.id,
  });
  if (publicationError) throw publicationError;
  assert(publication?.status === "published", "La plataforma lista no se publicó.");

  const publicClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const [{ data: publicSite }, { data: publicPlans }, { data: publicClasses }] = await Promise.all([
    publicClient.from("organization_sites").select("subdomain").eq("subdomain", slug),
    publicClient.from("gym_membership_plans").select("id").eq("organization_id", organizationId),
    publicClient.from("gym_classes").select("id").eq("organization_id", organizationId),
  ]);
  assert(publicSite?.length === 1 && publicPlans?.length === 1 && publicClasses?.length === 1, "La oferta publicada no cruza correctamente la frontera pública.");

  console.log("OK: onboarding aprobado → borrador idempotente → gates → plataforma pública funciona de punta a punta.");
} finally {
  if (organizationId) {
    await supabaseAdmin.from("organization_sites").delete().eq("organization_id", organizationId);
  }
  if (sessionId) await supabaseAdmin.from("discovery_sessions").delete().eq("id", sessionId);
  if (organizationId) await supabaseAdmin.from("organizations").delete().eq("id", organizationId);
}
