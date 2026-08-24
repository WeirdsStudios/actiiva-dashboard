import { describe, expect, test } from "bun:test";
import { ADJUSTMENT_WINDOW_DAYS, computeSessionLockState } from "./session-lock";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-08-24T12:00:00.000Z");

describe("computeSessionLockState", () => {
  test("never locks a session that has not been submitted", () => {
    expect(computeSessionLockState({ submitted_at: null, reopen_requested_at: null, reopen_authorized_until: null }, NOW)).toEqual({ locked: false, reopenRequested: false });
  });

  test("stays open through the full adjustment window", () => {
    const submitted = new Date(NOW - ADJUSTMENT_WINDOW_DAYS * DAY).toISOString();
    expect(computeSessionLockState({ submitted_at: submitted, reopen_requested_at: null, reopen_authorized_until: null }, NOW).locked).toBe(false);
  });

  test("locks after the window and preserves a pending reopen request", () => {
    const submitted = new Date(NOW - (ADJUSTMENT_WINDOW_DAYS + 1) * DAY).toISOString();
    expect(computeSessionLockState({ submitted_at: submitted, reopen_requested_at: new Date(NOW).toISOString(), reopen_authorized_until: null }, NOW)).toEqual({ locked: true, reopenRequested: true });
  });

  test("an explicit authorization reopens an old session", () => {
    const submitted = new Date(NOW - 60 * DAY).toISOString();
    const authorized = new Date(NOW + DAY).toISOString();
    expect(computeSessionLockState({ submitted_at: submitted, reopen_requested_at: null, reopen_authorized_until: authorized }, NOW).locked).toBe(false);
  });
});
