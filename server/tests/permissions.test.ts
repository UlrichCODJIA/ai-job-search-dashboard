import { describe, expect, test } from "bun:test";
import { paths } from "../src/lib/paths.js";
import { pathPatternMatches, toRepoRelativePath } from "../src/lib/permissions.js";

describe("toRepoRelativePath", () => {
  test("strips the repo root from an absolute path", () => {
    const absolute = `${paths.repoRoot}/documents/applications/acme/cv.tex`;
    expect(toRepoRelativePath(absolute)).toBe("documents/applications/acme/cv.tex");
  });

  test("normalizes backslashes before stripping the root", () => {
    const absolute = `${paths.repoRoot.replace(/\//g, "\\")}\\job_search_tracker.csv`;
    expect(toRepoRelativePath(absolute)).toBe("job_search_tracker.csv");
  });

  test("leaves an already-relative value untouched", () => {
    expect(toRepoRelativePath("upskill/2026-01-plan.md")).toBe("upskill/2026-01-plan.md");
  });

  test("leaves a path outside the repo root untouched", () => {
    expect(toRepoRelativePath("/etc/passwd")).toBe("/etc/passwd");
  });
});

describe("pathPatternMatches", () => {
  test("exact pattern matches only the identical value", () => {
    expect(pathPatternMatches("job_search_tracker.csv", "job_search_tracker.csv")).toBe(true);
    expect(pathPatternMatches("job_search_tracker.csv", "job_search_tracker.csv.bak")).toBe(false);
  });

  test("trailing wildcard matches the directory itself and anything nested under it", () => {
    expect(pathPatternMatches("documents/applications/*", "documents/applications/acme/cv.tex")).toBe(true);
    expect(pathPatternMatches("documents/applications/*", "documents/applications/")).toBe(true);
  });

  test("trailing wildcard does not match a sibling directory with a shared prefix", () => {
    expect(pathPatternMatches("upskill/*", "upskill-archive/2026-plan.md")).toBe(false);
  });

  test("trailing wildcard does not match the parent directory itself without the trailing segment", () => {
    expect(pathPatternMatches("documents/applications/*", "documents/applications")).toBe(false);
  });
});
