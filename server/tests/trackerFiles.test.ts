import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../src/lib/paths.js";
import { pdfSiblingPath, resolveTrackerFilePath } from "../src/lib/trackerFiles.js";

const cvDir = path.join(paths.repoRoot, "cv");
const coverDir = path.join(paths.repoRoot, "cover_letters");
const fixtureBase = "main___livecheck_fixture__";
const coverFixtureBase = "cover___livecheck_fixture__";

function cleanup() {
  for (const ext of [".tex", ".pdf"]) {
    const cv = path.join(cvDir, `${fixtureBase}${ext}`);
    if (existsSync(cv)) rmSync(cv);
    const cover = path.join(coverDir, `${coverFixtureBase}${ext}`);
    if (existsSync(cover)) rmSync(cover);
  }
}

describe("resolveTrackerFilePath", () => {
  afterEach(cleanup);

  test("resolves an existing cv/main_*.tex file", () => {
    mkdirSync(cvDir, { recursive: true });
    writeFileSync(path.join(cvDir, `${fixtureBase}.tex`), "content");
    expect(resolveTrackerFilePath("cv", `${fixtureBase}.tex`)).toBe(
      path.join(cvDir, `${fixtureBase}.tex`),
    );
  });

  test("resolves an existing cover_letters/cover_*.pdf file", () => {
    mkdirSync(coverDir, { recursive: true });
    writeFileSync(path.join(coverDir, `${coverFixtureBase}.pdf`), "content");
    expect(resolveTrackerFilePath("cover_letters", `${coverFixtureBase}.pdf`)).toBe(
      path.join(coverDir, `${coverFixtureBase}.pdf`),
    );
  });

  test("rejects a folder outside the allowlist", () => {
    expect(resolveTrackerFilePath("documents", `${fixtureBase}.tex`)).toBeNull();
  });

  test("rejects a filename that doesn't match the main_/cover_ + tex/pdf pattern", () => {
    mkdirSync(cvDir, { recursive: true });
    writeFileSync(path.join(cvDir, "notes.txt"), "content");
    expect(resolveTrackerFilePath("cv", "notes.txt")).toBeNull();
    rmSync(path.join(cvDir, "notes.txt"));
  });

  test("rejects a filename that doesn't exist on disk", () => {
    expect(resolveTrackerFilePath("cv", `${fixtureBase}.tex`)).toBeNull();
  });

  test("path traversal in the filename can't escape the folder", () => {
    mkdirSync(cvDir, { recursive: true });
    writeFileSync(path.join(cvDir, `${fixtureBase}.tex`), "content");
    expect(
      resolveTrackerFilePath("cv", `../../../../etc/${fixtureBase}.tex`),
    ).toBeNull();
  });
});

describe("pdfSiblingPath", () => {
  afterEach(cleanup);

  test("returns the relative pdf path when the sibling exists", () => {
    mkdirSync(cvDir, { recursive: true });
    writeFileSync(path.join(cvDir, `${fixtureBase}.pdf`), "content");
    expect(pdfSiblingPath(`cv/${fixtureBase}.tex`)).toBe(`cv/${fixtureBase}.pdf`);
  });

  test("returns null when no pdf sibling exists", () => {
    expect(pdfSiblingPath(`cv/${fixtureBase}.tex`)).toBeNull();
  });

  test("returns null for a non-.tex input", () => {
    expect(pdfSiblingPath(`cv/${fixtureBase}.pdf`)).toBeNull();
  });
});
