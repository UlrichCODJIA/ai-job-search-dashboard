import { describe, expect, test } from "bun:test";
import { daysUntil, isPastDeadline, isUrgentDeadline, resolveEffectiveDeadline } from "./deadline";

const NOW = new Date("2026-08-02T15:30:00");

describe("daysUntil", () => {
  test("today returns 0 regardless of time-of-day", () => {
    expect(daysUntil("2026-08-02", NOW)).toBe(0);
  });

  test("a future date returns a positive count", () => {
    expect(daysUntil("2026-08-09", NOW)).toBe(7);
  });

  test("a past date returns a negative count", () => {
    expect(daysUntil("2026-07-30", NOW)).toBe(-3);
  });

  test("an unparseable date returns null instead of NaN", () => {
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });
});

describe("isUrgentDeadline", () => {
  test("true for today", () => {
    expect(isUrgentDeadline("2026-08-02", NOW)).toBe(true);
  });

  test("true at the 7-day boundary (matches /rank's own rule)", () => {
    expect(isUrgentDeadline("2026-08-09", NOW)).toBe(true);
  });

  test("false just past the 7-day boundary", () => {
    expect(isUrgentDeadline("2026-08-10", NOW)).toBe(false);
  });

  test("false for a deadline that already passed -- that's 'past', not 'urgent'", () => {
    expect(isUrgentDeadline("2026-07-30", NOW)).toBe(false);
  });

  test("false for null/undefined/empty", () => {
    expect(isUrgentDeadline(null, NOW)).toBe(false);
    expect(isUrgentDeadline(undefined, NOW)).toBe(false);
    expect(isUrgentDeadline("", NOW)).toBe(false);
  });
});

describe("isPastDeadline", () => {
  test("true for a date before today", () => {
    expect(isPastDeadline("2026-07-30", NOW)).toBe(true);
  });

  test("false for today (still open)", () => {
    expect(isPastDeadline("2026-08-02", NOW)).toBe(false);
  });

  test("false for a future date", () => {
    expect(isPastDeadline("2026-08-09", NOW)).toBe(false);
  });

  test("false for null/undefined/empty", () => {
    expect(isPastDeadline(null, NOW)).toBe(false);
    expect(isPastDeadline(undefined, NOW)).toBe(false);
    expect(isPastDeadline("", NOW)).toBe(false);
  });
});

describe("resolveEffectiveDeadline", () => {
  test("prefers /rank's re-checked deadline when present", () => {
    expect(
      resolveEffectiveDeadline({ deadline: "2026-08-01", rank_deadline: "2026-08-09" }),
    ).toBe("2026-08-09");
  });

  test("falls back to /scrape's original deadline when /rank found nothing new", () => {
    expect(resolveEffectiveDeadline({ deadline: "2026-08-01", rank_deadline: null })).toBe(
      "2026-08-01",
    );
  });

  test("falls back to /scrape's deadline when the job has never been ranked", () => {
    expect(resolveEffectiveDeadline({ deadline: "2026-08-01" })).toBe("2026-08-01");
  });

  test("null when neither source has a deadline", () => {
    expect(resolveEffectiveDeadline({ deadline: null, rank_deadline: null })).toBeNull();
    expect(resolveEffectiveDeadline({})).toBeNull();
  });
});
