import { describe, expect, test } from "bun:test";
import { findMatchingApplication } from "./applicationMatch";
import type { ApplicationRecord } from "../api/types";

function app(companySlug: string, overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    slug: `${companySlug}_engineer`,
    companySlug,
    roleSlug: "engineer",
    outcome: null,
    hasJobPosting: false,
    hasCvDraft: false,
    hasCoverLetter: false,
    interviewPrep: [],
    trackerRow: null,
    ...overrides,
  };
}

describe("findMatchingApplication", () => {
  test("an exact normalized match is used even when a substring collision also exists", () => {
    const apps = [app("googlecloud"), app("google")];
    const result = findMatchingApplication(apps, "Google");
    expect(result?.companySlug).toBe("google");
  });

  test("an unambiguous substring match is still used (legitimate slug/name variation)", () => {
    const apps = [app("acmecorp")];
    const result = findMatchingApplication(apps, "Acme");
    expect(result?.companySlug).toBe("acmecorp");
  });

  test("an ambiguous substring match across two different applications attaches nothing", () => {
    const apps = [app("acmelabs"), app("acmeventures")];
    const result = findMatchingApplication(apps, "Acme");
    expect(result).toBeNull();
  });

  test("no match at all returns null", () => {
    const apps = [app("initech")];
    const result = findMatchingApplication(apps, "Acme Corp");
    expect(result).toBeNull();
  });

  test("an empty tracker company name returns null instead of matching every application", () => {
    const apps = [app("acme"), app("initech")];
    expect(findMatchingApplication(apps, "")).toBeNull();
  });

  test("company names differing only by punctuation/case still match exactly", () => {
    const apps = [app("acmecorp")];
    const result = findMatchingApplication(apps, "Acme-Corp");
    expect(result?.companySlug).toBe("acmecorp");
  });

  test("an empty applications list returns null", () => {
    expect(findMatchingApplication([], "Acme")).toBeNull();
  });
});
