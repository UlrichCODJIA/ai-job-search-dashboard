import { describe, expect, test } from "bun:test";
import { findTrackerRowForCompany } from "../src/lib/applications.js";
import type { TrackerRow } from "../src/lib/tracker.js";

function row(company: string, extra: Partial<TrackerRow> = {}): TrackerRow {
  return { company, id: `id-${company}`, bucket: "Active", ...extra };
}

describe("findTrackerRowForCompany", () => {
  test("an exact normalized match is used even when a substring collision also exists", () => {
    const rows = [row("Google Cloud"), row("Google")];
    const result = findTrackerRowForCompany("google", rows);
    expect(result?.company).toBe("Google");
  });

  test("an unambiguous substring match is still used (legitimate formatting differences)", () => {
    const rows = [row("Google, Inc.")];
    const result = findTrackerRowForCompany("google", rows);
    expect(result?.company).toBe("Google, Inc.");
  });

  test("an ambiguous substring match across two different companies attaches nothing", () => {
    const rows = [row("Meta Platforms"), row("MetaVerse Labs")];
    const result = findTrackerRowForCompany("meta", rows);
    expect(result).toBeNull();
  });

  test("no match at all returns null", () => {
    const rows = [row("Acme Corp")];
    const result = findTrackerRowForCompany("initech", rows);
    expect(result).toBeNull();
  });

  test("an empty companySlug returns null instead of matching every row", () => {
    const rows = [row("Acme Corp"), row("Initech")];
    const result = findTrackerRowForCompany("", rows);
    expect(result).toBeNull();
  });

  test("company names differing only by punctuation/case still match exactly", () => {
    const rows = [row("Acme Corp.")];
    const result = findTrackerRowForCompany("acme-corp", rows);
    expect(result?.company).toBe("Acme Corp.");
  });

  test("a row with an empty company field is never matched", () => {
    const rows = [row("")];
    const result = findTrackerRowForCompany("acme", rows);
    expect(result).toBeNull();
  });
});
