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
});
if (siteError) throw siteError;

const plans = [
  {
    organization_id: organizationId,
    slug: "base",
    name: "Base",
    description: "Tu espacio para entrenar con libertad y estructura.",
    price_cents: 79900,
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
  { organization_id: organizationId, slug: "power-1930", name: "Power", coach: "Nico", weekdays: [2, 4], start_time: "19:30", duration_minutes: 55, capacity: 12, intensity: "medium", published: true },
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

const customers = [
  { organization_id: organizationId, user_id: owner.id, plan_id: planId.get("progreso"), name: "Haza — socio demo", email: ownerEmail, status: "active", joined_on: "2026-05-12", next_payment_on: "2026-09-05" },
  { organization_id: organizationId, plan_id: planId.get("alto-rendimiento"), name: "Ana Torres", email: "ana.torres@example.com", status: "active", joined_on: "2026-02-03", next_payment_on: "2026-09-03" },
  { organization_id: organizationId, plan_id: planId.get("base"), name: "Mateo Ríos", email: "mateo.rios@example.com", status: "paused", joined_on: "2026-06-18", next_payment_on: null },
  { organization_id: organizationId, plan_id: planId.get("progreso"), name: "Sofía Núñez", email: "sofia.nunez@example.com", status: "lead", joined_on: null, next_payment_on: null },
];

const { error: customersError } = await supabaseAdmin
  .from("gym_customers")
  .upsert(customers, { onConflict: "organization_id,email" });
if (customersError) throw customersError;

console.log(JSON.stringify({ organizationId, site: "mexgym", plans: plans.length, classes: classes.length, customers: customers.length }));
