import { createOrganizationSlug } from "@/features/organizations/lib/slug";

export interface DiscoveryResponseInput {
  question_id: string;
  status: string;
  value: unknown;
}

export interface ProvisionedPlanInput {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  billingPeriod: "month" | "year" | "one_time";
  durationCount: number;
  durationUnit: "day" | "week" | "month" | "year";
  classAccess: "unlimited" | "credits";
  classCredits: number | null;
  published: boolean;
}

export interface ProvisionedClassInput {
  slug: string;
  name: string;
  coach: string;
  weekdays: number[];
  startTime: string;
  durationMinutes: number;
  capacity: number;
  intensity: "medium";
  published: boolean;
}

export interface PlatformDraftInput {
  siteName: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  primaryColor: string;
  accentColor: string;
  plans: ProvisionedPlanInput[];
  classes: ProvisionedClassInput[];
  dropInPriceCents: number | null;
}

const DAY_BY_NAME: Record<string, number> = {
  domingo: 0,
  dom: 0,
  lunes: 1,
  lun: 1,
  martes: 2,
  mar: 2,
  miercoles: 3,
  mie: 3,
  jueves: 4,
  jue: 4,
  viernes: 5,
  vie: 5,
  sabado: 6,
  sab: 6,
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(text(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), minimum), maximum);
}

export function parsePriceCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value >= 0 ? Math.round(value * 100) : null;
  const raw = text(value).replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) normalized = raw.replace(/,/g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(raw)) normalized = raw.replace(/,/g, "");
  else normalized = raw.replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000 ? Math.round(amount * 100) : null;
}

function parseBillingPeriod(value: unknown): Pick<ProvisionedPlanInput, "billingPeriod" | "durationCount" | "durationUnit" | "classAccess" | "classCredits"> {
  const period = normalize(text(value));
  const amount = clampInteger(period.match(/\d+/)?.[0], 1, 1, 365);
  if (period.includes("semana")) return { billingPeriod: "month", durationCount: amount, durationUnit: "week", classAccess: "unlimited", classCredits: null };
  if (period.includes("ano") || period.includes("anual") || period.includes("year")) return { billingPeriod: "year", durationCount: amount, durationUnit: "year", classAccess: "unlimited", classCredits: null };
  if (period.includes("dia")) return { billingPeriod: "one_time", durationCount: amount, durationUnit: "day", classAccess: "unlimited", classCredits: null };
  if (period.includes("clase") || period.includes("sesion")) return { billingPeriod: "one_time", durationCount: 1, durationUnit: "month", classAccess: "credits", classCredits: amount };
  return { billingPeriod: "month", durationCount: amount, durationUnit: "month", classAccess: "unlimited", classCredits: null };
}

function parseWeekdays(value: unknown): number[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap((item) => parseWeekdays(item)))].sort();
  const normalized = normalize(text(value));
  const found = Object.entries(DAY_BY_NAME)
    .filter(([day]) => new RegExp(`(^|[^a-z])${day}([^a-z]|$)`).test(normalized))
    .map(([, index]) => index);
  return [...new Set(found)].sort();
}

function parseTime(value: unknown): string | null {
  const raw = normalize(text(value));
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "00");
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function responseMap(responses: DiscoveryResponseInput[]): Map<string, unknown> {
  return new Map(responses.filter((response) => response.status !== "unanswered").map((response) => [response.question_id, response.value]));
}

function brandColors(value: unknown): [string, string] {
  const matches = text(value).match(/#[0-9a-fA-F]{6}/g) ?? [];
  return [matches[0]?.toUpperCase() ?? "#20252B", matches[1]?.toUpperCase() ?? "#FF6B4A"];
}

export function buildPlatformDraft(businessName: string, responses: DiscoveryResponseInput[]): PlatformDraftInput {
  const byQuestion = responseMap(responses);
  const siteName = text(byQuestion.get("biz.name")) || businessName.trim();
  const [primaryColor, accentColor] = brandColors(byQuestion.get("brand.colors"));
  const tagline = text(byQuestion.get("website.tagline")) || `Muévete a tu manera en ${siteName}.`;
  const description = text(byQuestion.get("audience.description")) || `Conoce los servicios, horarios y membresías de ${siteName}.`;

  const plans = rows(byQuestion.get("pricing.membership_plans")).flatMap((row, index) => {
    const name = text(row.plan_name) || text(row.name);
    const priceCents = parsePriceCents(row.price);
    if (!name || priceCents === null) return [];
    const period = parseBillingPeriod(row.billing_period);
    return [{
      slug: `${createOrganizationSlug(name).slice(0, 54)}-${index + 1}`,
      name: name.slice(0, 80),
      description: "",
      priceCents,
      ...period,
      published: true,
    } satisfies ProvisionedPlanInput];
  });

  const serviceDurations = new Map(
    rows(byQuestion.get("offerings.services_table")).flatMap((row) => {
      const name = normalize(text(row.name));
      return name ? [[name, clampInteger(row.duration_minutes, 60, 15, 180)] as const] : [];
    }),
  );
  const classGroups = new Map<string, ProvisionedClassInput>();
  for (const row of rows(byQuestion.get("schedule.weekly_table"))) {
    const name = text(row.class_name) || text(row.name);
    const startTime = parseTime(row.time);
    const weekdays = parseWeekdays(row.day);
    if (!name || !startTime || weekdays.length === 0) continue;
    const key = `${normalize(name)}:${startTime}`;
    const current = classGroups.get(key);
    if (current) {
      current.weekdays = [...new Set([...current.weekdays, ...weekdays])].sort();
      continue;
    }
    classGroups.set(key, {
      slug: `${createOrganizationSlug(name).slice(0, 48)}-${startTime.replace(":", "")}`,
      name: name.slice(0, 80),
      coach: `Equipo ${siteName}`.slice(0, 80),
      weekdays,
      startTime,
      durationMinutes: serviceDurations.get(normalize(name)) ?? 60,
      capacity: clampInteger(row.capacity, 12, 1, 200),
      intensity: "medium",
      published: true,
    });
  }

  return {
    siteName: siteName.slice(0, 100),
    tagline: tagline.slice(0, 180),
    description: description.slice(0, 600),
    address: text(byQuestion.get("location.address")).slice(0, 300),
    phone: text(byQuestion.get("location.phone")).slice(0, 40),
    primaryColor,
    accentColor,
    plans,
    classes: [...classGroups.values()],
    dropInPriceCents: parsePriceCents(byQuestion.get("pricing.dropin_price")),
  };
}
