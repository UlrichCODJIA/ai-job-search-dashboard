import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  findTrackerRowForCompany,
  parseInterviewPrepFiles,
  resolveApplicationFilePath,
} from "../src/lib/applications.js";
import { paths } from "../src/lib/paths.js";
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

describe("parseInterviewPrepFiles", () => {
  test("a prep pack and cheat sheet for the same stage merge into one entry", () => {
    const result = parseInterviewPrepFiles([
      "interview_prep_phone_screen.md",
      "interview_cheatsheet_phone_screen.md",
    ]);
    expect(result).toEqual([
      { stage: "phone_screen", hasPrepPack: true, hasCheatSheet: true },
    ]);
  });

  test("a prep pack with no matching cheat sheet reports hasCheatSheet false", () => {
    const result = parseInterviewPrepFiles(["interview_prep_technical.md"]);
    expect(result).toEqual([
      { stage: "technical", hasPrepPack: true, hasCheatSheet: false },
    ]);
  });

  test("a cheat sheet with no matching prep pack reports hasPrepPack false", () => {
    const result = parseInterviewPrepFiles(["interview_cheatsheet_final_round.md"]);
    expect(result).toEqual([
      { stage: "final_round", hasPrepPack: false, hasCheatSheet: true },
    ]);
  });

  test("multiple stages are kept separate", () => {
    const result = parseInterviewPrepFiles([
      "interview_prep_phone_screen.md",
      "interview_prep_technical.md",
    ]);
    expect(result.map((r) => r.stage).sort()).toEqual(["phone_screen", "technical"]);
  });

  test("unrelated files (job_posting.md, cv_draft.tex, outcome.md) are ignored", () => {
    const result = parseInterviewPrepFiles(["job_posting.md", "cv_draft.tex", "outcome.md"]);
    expect(result).toEqual([]);
  });

  test("an empty directory listing returns an empty array", () => {
    expect(parseInterviewPrepFiles([])).toEqual([]);
  });
});

describe("resolveApplicationFilePath", () => {
  const slug = "__test-fixture-co_role__";
  const dir = path.join(paths.applicationsDir, slug);

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("resolves a known filename that exists on disk", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "cv_draft.tex"), "content");

    const resolved = resolveApplicationFilePath(slug, "cv_draft.tex");
    expect(resolved).toBe(path.join(dir, "cv_draft.tex"));
    expect(existsSync(resolved!)).toBe(true);
  });

  test("returns null for a filename that isn't in the known list", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "notes.txt"), "content");

    expect(resolveApplicationFilePath(slug, "notes.txt")).toBeNull();
  });

  test("returns null when the known filename doesn't exist yet", () => {
    mkdirSync(dir, { recursive: true });
    expect(resolveApplicationFilePath(slug, "cover_letter.tex")).toBeNull();
  });

  test("path segments in slug or filename can't escape their directory", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "cv_draft.tex"), "content");

    expect(resolveApplicationFilePath("../../../etc", "cv_draft.tex")).toBeNull();
    expect(
      resolveApplicationFilePath(slug, "../../../../etc/passwd"),
    ).toBeNull();
  });

  test("interview prep and cheat sheet filenames for any stage resolve", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "interview_prep_final_round.md"), "content");

    expect(resolveApplicationFilePath(slug, "interview_prep_final_round.md")).toBe(
      path.join(dir, "interview_prep_final_round.md"),
    );
  });
});
