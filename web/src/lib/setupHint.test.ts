import { describe, expect, test } from "bun:test";
import { buildSetupHint } from "./setupHint";
import type { ApplicationRecord, ProfileData } from "../api/types";

function profile(placeholders: ProfileData["placeholders"] = []): ProfileData {
  return { name: null, claudeMdSections: [], skillFiles: [], placeholders };
}

function resolvedApp(slug: string, status = "rejected"): ApplicationRecord {
  return {
    slug,
    companySlug: slug,
    roleSlug: "engineer",
    outcome: { status, stages: [], notes: "" },
    hasJobPosting: false,
    hasCvDraft: false,
    hasCoverLetter: false,
    interviewPrep: [],
    trackerRow: null,
  };
}

describe("buildSetupHint", () => {
  test("returns undefined when there is nothing to hint at", () => {
    expect(buildSetupHint(profile(), {})).toBeUndefined();
    expect(buildSetupHint(undefined, undefined)).toBeUndefined();
  });

  test("mentions non-empty document folders", () => {
    const hint = buildSetupHint(profile(), { cv: ["resume.pdf"], linkedin: [], diplomas: ["degree.pdf"] });
    expect(hint).toBe("I have documents in: cv, diplomas.");
  });

  test("mentions files with remaining placeholders, deduplicated", () => {
    const hint = buildSetupHint(
      profile([
        { file: "CLAUDE.md", match: "[YOUR_NAME]", line: 1 },
        { file: "CLAUDE.md", match: "[YOUR_PHONE]", line: 2 },
        { file: "05-cv-templates.md", match: "[YOUR_LINKEDIN_URL]", line: 46 },
      ]),
      {},
    );
    expect(hint).toBe("My profile still has placeholder tokens left in: CLAUDE.md, 05-cv-templates.md.");
  });

  test("combines both hints when both apply", () => {
    const hint = buildSetupHint(
      profile([{ file: "CLAUDE.md", match: "[YOUR_NAME]", line: 1 }]),
      { cv: ["resume.pdf"] },
    );
    expect(hint).toBe(
      "I have documents in: cv. My profile still has placeholder tokens left in: CLAUDE.md.",
    );
  });

  test("ignores folders that exist but have no files", () => {
    expect(buildSetupHint(profile(), { cv: [], linkedin: [] })).toBeUndefined();
  });

  test("mentions resolved outcomes once the threshold (3) is reached", () => {
    const apps = [resolvedApp("a"), resolvedApp("b"), resolvedApp("c")];
    const hint = buildSetupHint(profile(), {}, apps);
    expect(hint).toBe(
      "I have 3 resolved application outcomes on record - please fold them into the fit framework (Path A).",
    );
  });

  test("stays silent below the threshold", () => {
    const apps = [resolvedApp("a"), resolvedApp("b")];
    expect(buildSetupHint(profile(), {}, apps)).toBeUndefined();
  });

  test("in_progress outcomes never count toward the resolved threshold", () => {
    const apps = [
      resolvedApp("a", "in_progress"),
      resolvedApp("b", "in_progress"),
      resolvedApp("c", "in_progress"),
    ];
    expect(buildSetupHint(profile(), {}, apps)).toBeUndefined();
  });

  test("applications with no outcome.md at all are ignored", () => {
    const noOutcome: ApplicationRecord = { ...resolvedApp("a"), outcome: null };
    expect(buildSetupHint(profile(), {}, [noOutcome, noOutcome, noOutcome])).toBeUndefined();
  });

  test("combines with the other hints when both apply", () => {
    const apps = [resolvedApp("a"), resolvedApp("b"), resolvedApp("c")];
    const hint = buildSetupHint(profile(), { cv: ["resume.pdf"] }, apps);
    expect(hint).toBe(
      "I have documents in: cv. I have 3 resolved application outcomes on record - please fold them into the fit framework (Path A).",
    );
  });

  test("omitting applications entirely does not throw and yields no resolved-outcomes hint", () => {
    expect(buildSetupHint(profile(), {})).toBeUndefined();
  });
});
