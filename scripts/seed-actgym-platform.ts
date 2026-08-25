import { supabaseAdmin } from "../src/lib/supabase-admin";

const ownerEmail = process.argv[2]?.trim().toLowerCase();
if (!ownerEmail) throw new Error("Uso: bun run scripts/seed-actgym-platform.ts <correo-del-propietario>");

const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const owner = users.users.find((user) => user.email?.toLowerCase() === ownerEmail);
if (!owner) throw new Error(`No existe el usuario ${ownerEmail}`);

const { data: organization, error: organizationError } = await supabaseAdmin
  .from("organizations")
  .select("id")
  .eq("slug", "actgym")
  .single();
if (organizationError || !organization) throw organizationError ?? new Error("ACTGym no existe");

const organizationId = organization.id;
const { error: siteError } = await supabaseAdmin.from("organization_sites").upsert({
  organization_id: organizationId,
  subdomain: "mexgym",
  site_name: "ACTGym",
  industry: "gym",
  status: "published",
  tagline: "Entrena con estructura. Progresa con intención.",
  description: "Fuerza, condición y movilidad con un plan que sí puedes sostener.",
  address: "Av. Movimiento 120, Ciudad de México",
  phone: "55 0000 2040",
  primary_color: "#20252B",
  accent_color: "#FF6B4A",
  schedule_interest_threshold: 4,
  demand_hold_hours: 24,
  timezone: "America/Mexico_City",
  currency: "MXN",
});
if (siteError) throw siteError;

const plans = [
  {
    organization_id: organizationId,
    slug: "base",
    name: "Base",
    description: "Tu espacio para entrenar con libertad y estructura.",
    price_cents: 79900,
    duration_count: 1,
    duration_unit: "month",
    class_access: "credits",
    class_credits: 8,
    grace_days: 2,
    auto_renew_available: true,
    features: ["Acceso a piso de fuerza", "Evaluación inicial", "App de seguimiento"],
    published: true,
    sort_order: 1,
  },
  {
    organization_id: organizationId,
    slug: "progreso",
    name: "Progreso",
    description: "Acompañamiento constante para avanzar semana a semana.",
    price_cents: 129000,
    duration_count: 1,
    duration_unit: "month",
    class_access: "unlimited",
    class_credits: null,
    grace_days: 3,
    auto_renew_available: true,
    features: ["Todo lo de Base", "Clases grupales ilimitadas", "Evaluación mensual"],
    published: true,
    sort_order: 2,
  },
  {
    organization_id: organizationId,
    slug: "alto-rendimiento",
    name: "Alto rendimiento",
    description: "Entrenamiento de precisión con seguimiento cercano.",
    price_cents: 189000,
    duration_count: 1,
    duration_unit: "month",
    class_access: "unlimited",
    class_credits: null,
    grace_days: 5,
    auto_renew_available: true,
    features: ["Todo lo de Progreso", "Programación personalizada", "Sesión técnica semanal"],
    published: true,
    sort_order: 3,
  },
];

const { error: plansError } = await supabaseAdmin
  .from("gym_membership_plans")
  .upsert(plans, { onConflict: "organization_id,slug" });
if (plansError) throw plansError;

const classes = [
  { organization_id: organizationId, slug: "fuerza-0600", name: "Fuerza 06", coach: "Vale", weekdays: [1, 3, 5], start_time: "06:00", duration_minutes: 55, capacity: 12, intensity: "high", published: true },
  { organization_id: organizationId, slug: "engine-0700", name: "Engine", coach: "Diego", weekdays: [2, 4], start_time: "07:00", duration_minutes: 45, capacity: 14, intensity: "high", published: true },
  { organization_id: organizationId, slug: "movilidad-1830", name: "Movilidad", coach: "Mar", weekdays: [1, 3], start_time: "18:30", duration_minutes: 45, capacity: 16, intensity: "base", published: true },
  { organization_id: organizationId, slug: "power-1930", name: "Power", coach: "Nico", weekdays: [2, 4], start_time: "19:30", duration_minutes: 55, capacity: 8, intensity: "medium", published: true },
];

const { error: classesError } = await supabaseAdmin
  .from("gym_classes")
  .upsert(classes, { onConflict: "organization_id,slug" });
if (classesError) throw classesError;

const { data: storedPlans, error: storedPlansError } = await supabaseAdmin
  .from("gym_membership_plans")
  .select("id, slug")
  .eq("organization_id", organizationId);
if (storedPlansError) throw storedPlansError;
const planId = new Map((storedPlans ?? []).map((plan) => [plan.slug, plan.id]));

const membershipBalanceResults = await Promise.all(plans.map((plan) => supabaseAdmin
  .from("gym_customer_memberships")
  .update({
    price_cents: plan.price_cents,
    class_credits_total: plan.class_access === "credits" ? plan.class_credits : null,
  })
  .eq("organization_id", organizationId)
  .eq("plan_id", planId.get(plan.slug))));
const membershipBalanceError = membershipBalanceResults.find((result) => result.error)?.error;
if (membershipBalanceError) throw membershipBalanceError;

const catalog = [
  ...plans.map((plan) => ({
    organization_id: organizationId,
    membership_plan_id: planId.get(plan.slug),
    slug: `membresia-${plan.slug}`,
    sku: `MEM-${plan.slug.toUpperCase()}`,
    item_type: "membership",
    name: plan.name,
    description: plan.description,
    price_cents: plan.price_cents,
    cost_cents: 0,
    tracks_inventory: false,
    published: true,
    active: true,
  })),
  { organization_id: organizationId, slug: "agua-mineral", sku: "BEB-AGUA", item_type: "product", name: "Agua mineral", description: "Botella fría de 600 ml", price_cents: 2500, cost_cents: 1100, tracks_inventory: true, published: false, active: true },
  { organization_id: organizationId, slug: "proteina-lista", sku: "BEB-PROT", item_type: "product", name: "Proteína lista", description: "Bebida de proteína individual", price_cents: 6500, cost_cents: 3800, tracks_inventory: true, published: false, active: true },
  { organization_id: organizationId, slug: "vendas-entrenamiento", sku: "ACC-VEND", item_type: "product", name: "Vendas de entrenamiento", description: "Par de vendas ACTGym", price_cents: 29900, cost_cents: 14500, tracks_inventory: true, published: false, active: true },
  { organization_id: organizationId, slug: "evaluacion-corporal", sku: "SER-EVAL", item_type: "service", name: "Evaluación corporal", description: "Medición y revisión de objetivos", price_cents: 45000, cost_cents: 0, tracks_inventory: false, published: true, active: true },
  { organization_id: organizationId, slug: "clase-visita", sku: "SER-DROP", item_type: "drop_in", name: "Clase de visita", description: "Una sesión para conocer ACTGym", price_cents: 18000, cost_cents: 0, tracks_inventory: false, published: true, active: true },
];

const { error: catalogError } = await supabaseAdmin
  .from("gym_catalog_items")
  .upsert(catalog, { onConflict: "organization_id,slug" });
if (catalogError) throw catalogError;

const [{ data: primaryBranch, error: branchError }, { data: inventoryItems, error: inventoryItemsError }] = await Promise.all([
  supabaseAdmin.from("gym_branches").select("id").eq("organization_id", organizationId).eq("is_primary", true).single(),
  supabaseAdmin.from("gym_catalog_items").select("id, slug").eq("organization_id", organizationId).eq("tracks_inventory", true),
]);
if (branchError || inventoryItemsError) throw branchError ?? inventoryItemsError;

const openingInventory: Record<string, number> = { "agua-mineral": 48, "proteina-lista": 24, "vendas-entrenamiento": 12 };
const { error: inventoryError } = await supabaseAdmin.from("gym_inventory_levels").upsert(
  (inventoryItems ?? []).map((item) => ({
    organization_id: organizationId,
    branch_id: primaryBranch.id,
    catalog_item_id: item.id,
    quantity: openingInventory[item.slug] ?? 0,
    reorder_point: item.slug === "agua-mineral" ? 12 : 5,
  })),
  { onConflict: "branch_id,catalog_item_id" },
);
if (inventoryError) throw inventoryError;

const { error: connectionsError } = await supabaseAdmin.from("gym_provider_connections").upsert([
  { organization_id: organizationId, provider: "mercado_pago", status: "disconnected", display_name: "Mercado Pago del negocio" },
  { organization_id: organizationId, provider: "whatsapp", status: "disconnected", display_name: "WhatsApp de ACTGym" },
], { onConflict: "organization_id,provider" });
if (connectionsError) throw connectionsError;

const customers = [
  { organization_id: organizationId, user_id: owner.id, plan_id: planId.get("progreso"), name: "Haza — socio demo", email: ownerEmail, status: "active", joined_on: "2026-05-12", next_payment_on: "2026-09-05" },
  { organization_id: organizationId, plan_id: planId.get("alto-rendimiento"), name: "Ana Torres", email: "ana.torres@example.com", status: "active", joined_on: "2026-02-03", next_payment_on: "2026-09-03" },
  { organization_id: organizationId, plan_id: planId.get("base"), name: "Mateo Ríos", email: "mateo.rios@example.com", status: "paused", joined_on: "2026-06-18", next_payment_on: null },
  { organization_id: organizationId, plan_id: planId.get("progreso"), name: "Sofía Núñez", email: "sofia.nunez@example.com", status: "lead", joined_on: null, next_payment_on: null },
  { organization_id: organizationId, plan_id: planId.get("progreso"), name: "Luis Mendoza", email: "luis.mendoza@example.com", status: "active", joined_on: "2026-01-14", next_payment_on: "2026-09-14" },
  { organization_id: organizationId, plan_id: planId.get("base"), name: "Camila Soto", email: "camila.soto@example.com", status: "active", joined_on: "2026-03-22", next_payment_on: "2026-09-22" },
  { organization_id: organizationId, plan_id: planId.get("alto-rendimiento"), name: "Jorge Vidal", email: "jorge.vidal@example.com", status: "active", joined_on: "2026-04-09", next_payment_on: "2026-09-09" },
  { organization_id: organizationId, plan_id: planId.get("progreso"), name: "Renata Cruz", email: "renata.cruz@example.com", status: "active", joined_on: "2026-05-28", next_payment_on: "2026-09-28" },
  { organization_id: organizationId, plan_id: planId.get("base"), name: "Pablo León", email: "pablo.leon@example.com", status: "active", joined_on: "2026-06-05", next_payment_on: "2026-09-05" },
  { organization_id: organizationId, plan_id: planId.get("progreso"), name: "Fernanda Gil", email: "fernanda.gil@example.com", status: "active", joined_on: "2026-07-11", next_payment_on: "2026-09-11" },
  { organization_id: organizationId, plan_id: planId.get("alto-rendimiento"), name: "Marco Luna", email: "marco.luna@example.com", status: "active", joined_on: "2026-07-30", next_payment_on: "2026-09-30" },
  { organization_id: organizationId, plan_id: planId.get("base"), name: "Lucía Paredes", email: "lucia.paredes@example.com", status: "lead", joined_on: null, next_payment_on: null },
];

const { error: customersError } = await supabaseAdmin
  .from("gym_customers")
  .upsert(customers, { onConflict: "organization_id,email" });
if (customersError) throw customersError;

const [{ data: storedClasses, error: storedClassesError }, { data: storedCustomers, error: storedCustomersError }] = await Promise.all([
  supabaseAdmin.from("gym_classes").select("id, slug, weekdays").eq("organization_id", organizationId),
  supabaseAdmin.from("gym_customers").select("id, email, status").eq("organization_id", organizationId),
]);
if (storedClassesError || storedCustomersError) throw storedClassesError ?? storedCustomersError;

function nextOccurrence(weekdays: number[]): string {
  const candidate = new Date();
  candidate.setUTCHours(12, 0, 0, 0);
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(candidate);
    date.setUTCDate(candidate.getUTCDate() + offset);
    if (weekdays.includes(date.getUTCDay())) return date.toISOString().slice(0, 10);
  }
  throw new Error("No se encontró una fecha para la clase");
}

const classBySlug = new Map((storedClasses ?? []).map((gymClass) => [gymClass.slug, gymClass]));
const activeCustomers = (storedCustomers ?? []).filter((customer) => customer.status === "active");
const ownerCustomer = activeCustomers.find((customer) => customer.email === ownerEmail);
const testQueue = [...activeCustomers.filter((customer) => customer.id !== ownerCustomer?.id), ...(ownerCustomer ? [ownerCustomer] : [])];
const forceClass = classBySlug.get("fuerza-0600");
const engineClass = classBySlug.get("engine-0700");
const mobilityClass = classBySlug.get("movilidad-1830");
const powerClass = classBySlug.get("power-1930");
if (!forceClass || !engineClass || !mobilityClass || !powerClass) throw new Error("La agenda ACTGym está incompleta");

const forceDate = nextOccurrence(forceClass.weekdays);
const engineDate = nextOccurrence(engineClass.weekdays);
const powerDate = nextOccurrence(powerClass.weekdays);
const reservations = [
  ...testQueue.slice(0, 6).map((customer) => ({ organization_id: organizationId, class_id: forceClass.id, customer_id: customer.id, class_date: forceDate, status: "reserved" })),
  ...testQueue.slice(0, 4).map((customer) => ({ organization_id: organizationId, class_id: engineClass.id, customer_id: customer.id, class_date: engineDate, status: "reserved" })),
  ...testQueue.slice(0, 9).map((customer, index) => ({ organization_id: organizationId, class_id: powerClass.id, customer_id: customer.id, class_date: powerDate, status: index < 8 ? "reserved" : "waitlisted" })),
];
const { error: reservationsError } = await supabaseAdmin
  .from("gym_class_reservations")
  .upsert(reservations, { onConflict: "class_id,customer_id,class_date" });
if (reservationsError) throw reservationsError;

console.log(JSON.stringify({
  organizationId,
  site: "mexgym",
  plans: plans.length,
  classes: classes.length,
  customers: customers.length,
  reservations: reservations.length,
  demandSignals: 0,
  catalogItems: catalog.length,
  inventoryItems: inventoryItems?.length ?? 0,
}));
