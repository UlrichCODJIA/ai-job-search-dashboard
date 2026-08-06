import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

const { listTrackerRows } = await import("../src/lib/tracker.js");

const HEADER =
  "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source";

function trackerPath(): string {
  return path.join(testDir, "job_search_tracker.csv");
}

describe("listTrackerRows -- pdf sibling detection", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "tracker-pdf-test-"));
    mockPaths.tracker = trackerPath();
    mockPaths.repoRoot = testDir;
    mkdirSync(path.join(testDir, "cv"), { recursive: true });
    mkdirSync(path.join(testDir, "cover_letters"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("reports the pdf path when a compiled sibling exists", async () => {
    writeFileSync(path.join(testDir, "cv", "main_acme_engineer.pdf"), "pdf content");
    const csv = [
      HEADER,
      "2026-01-01,Acme,Software,Engineer,full_time,referral,applied,Jane,high,,cv/main_acme_engineer.tex,,https://example.com",
    ].join("\n");
    writeFileSync(trackerPath(), csv, "utf-8");

    const rows = await listTrackerRows();
    expect(rows[0].cv_file_pdf).toBe("cv/main_acme_engineer.pdf");
  });

  test("leaves cv_file_pdf empty when no compiled pdf exists yet", async () => {
    const csv = [
      HEADER,
      "2026-01-01,Acme,Software,Engineer,full_time,referral,applied,Jane,high,,cv/main_acme_engineer.tex,,https://example.com",
    ].join("\n");
    writeFileSync(trackerPath(), csv, "utf-8");

    const rows = await listTrackerRows();
    expect(rows[0].cv_file_pdf).toBe("");
  });

  test("leaves both pdf fields empty when the row has no cv_file/cover_letter_file at all", async () => {
    const csv = [
      HEADER,
      "2026-01-01,Acme,Software,Engineer,full_time,referral,drafted,Jane,high,,,,",
    ].join("\n");
    writeFileSync(trackerPath(), csv, "utf-8");

    const rows = await listTrackerRows();
    expect(rows[0].cv_file_pdf).toBe("");
    expect(rows[0].cover_letter_file_pdf).toBe("");
  });

  test("cover_letter_file_pdf resolves independently of cv_file_pdf", async () => {
    writeFileSync(
      path.join(testDir, "cover_letters", "cover_acme_engineer.pdf"),
      "pdf content",
    );
    const csv = [
      HEADER,
      "2026-01-01,Acme,Software,Engineer,full_time,referral,applied,Jane,high,,cv/main_acme_engineer.tex,cover_letters/cover_acme_engineer.tex,https://example.com",
    ].join("\n");
    writeFileSync(trackerPath(), csv, "utf-8");

    const rows = await listTrackerRows();
    expect(rows[0].cv_file_pdf).toBe("");
    expect(rows[0].cover_letter_file_pdf).toBe("cover_letters/cover_acme_engineer.pdf");
  });
});
