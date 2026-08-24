import { describe, expect, test } from "bun:test";
import { addDaysToISO, isBookableISODate, isUpcomingOccurrence, timeInMexico, todayInMexico, weekdayFromISO } from "./calendar";

describe("gym calendar", () => {
  test("uses the business timezone around UTC midnight", () => {
    const instant = new Date("2026-08-25T04:30:00Z");
    expect(todayInMexico(instant)).toBe("2026-08-24");
    expect(timeInMexico(instant)).toBe("22:30");
  });

  test("adds days without timezone drift", () => {
    expect(addDaysToISO("2026-08-31", 1)).toBe("2026-09-01");
    expect(weekdayFromISO("2026-08-24")).toBe(1);
  });

  test("limits bookings to the next 31 days", () => {
    expect(isBookableISODate("2026-08-24", "2026-08-24")).toBe(true);
    expect(isBookableISODate("2026-09-24", "2026-08-24")).toBe(true);
    expect(isBookableISODate("2026-09-25", "2026-08-24")).toBe(false);
  });

  test("hides occurrences that already started", () => {
    const now = new Date("2026-08-24T20:00:00Z");
    expect(isUpcomingOccurrence("2026-08-24", "13:59", now)).toBe(false);
    expect(isUpcomingOccurrence("2026-08-24", "14:01", now)).toBe(true);
    expect(isUpcomingOccurrence("2026-08-25", "06:00", now)).toBe(true);
  });
});
