import { describe, expect, test } from "bun:test";
import { buildPlatformDraft, parsePriceCents } from "./discovery-platform";

describe("platform draft from discovery", () => {
  test("normalizes Mexican prices", () => {
    expect(parsePriceCents("$1,299 MXN")).toBe(129900);
    expect(parsePriceCents("850.50")).toBe(85050);
    expect(parsePriceCents("sin definir")).toBeNull();
  });

  test("maps plans and merges schedule rows for the same class", () => {
    const draft = buildPlatformDraft("StudioFit", [
      { question_id: "biz.name", status: "confirmed", value: "StudioFit" },
      { question_id: "brand.colors", status: "confirmed", value: "Azul #112233 y coral #EE6644" },
      { question_id: "pricing.membership_plans", status: "confirmed", value: [
        { plan_name: "Flow mensual", price: "$1,200", billing_period: "mensual" },
        { plan_name: "Bono 8 clases", price: 900, billing_period: "8 clases" },
      ] },
      { question_id: "offerings.services_table", status: "confirmed", value: [{ name: "Pilates", duration_minutes: 50 }] },
      { question_id: "schedule.weekly_table", status: "confirmed", value: [
        { day: "Lunes", class_name: "Pilates", time: "7:00 am", capacity: 10 },
        { day: "Miércoles", class_name: "Pilates", time: "07:00", capacity: 10 },
      ] },
    ]);

    expect(draft.primaryColor).toBe("#112233");
    expect(draft.plans).toHaveLength(2);
    expect(draft.plans[1].classCredits).toBe(8);
    expect(draft.classes).toHaveLength(1);
    expect(draft.classes[0]).toMatchObject({ weekdays: [1, 3], startTime: "07:00", durationMinutes: 50, capacity: 10 });
  });
});
