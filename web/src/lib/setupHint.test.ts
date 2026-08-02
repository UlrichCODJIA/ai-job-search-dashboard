import { describe, expect, test } from "bun:test";
import { buildSetupHint } from "./setupHint";
import type { ProfileData } from "../api/types";

function profile(placeholders: ProfileData["placeholders"] = []): ProfileData {
  return { name: null, claudeMdSections: [], skillFiles: [], placeholders };
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
});
