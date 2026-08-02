import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

const { updateProfileSection, ProfileSectionConflictError, getProfileData } = await import(
  "../src/lib/profile.js"
);
const { writeFileSync, mkdirSync } = await import("node:fs");

function claudeMdPath(): string {
  return path.join(testDir, "CLAUDE.md");
}

const FIXTURE = [
  "# Job Application Assistant for Test Candidate",
  "",
  "## Candidate Profile",
  "",
  "Some intro text.",
  "",
  "## Skills",
  "",
  "- Python",
  "- TypeScript",
  "",
  "## Experience",
  "",
  "Worked places.",
  "",
].join("\n");

describe("updateProfileSection -- section-identity conflict detection", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "profile-test-"));
    mockPaths.claudeMd = claudeMdPath();
    mockPaths.profileSkillsDir = testDir;
    writeFileSync(claudeMdPath(), FIXTURE, "utf-8");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("matching heading: the save succeeds and only that section's content changes", async () => {
    await updateProfileSection("CLAUDE.md", 2, "Skills", "- Rust");

    const written = readFileSync(claudeMdPath(), "utf-8");
    expect(written).toContain("## Skills\n\n- Rust");
    expect(written).toContain("Some intro text.");
    expect(written).toContain("Worked places.");
  });

  test("stale index (heading shifted): the save is rejected, not silently misapplied", async () => {
    const shifted = FIXTURE.replace("## Experience", "## Certifications\n\nSomething.\n\n## Experience");
    writeFileSync(claudeMdPath(), shifted, "utf-8");
    const attempt = updateProfileSection("CLAUDE.md", 3, "Experience", "New experience text");
    await expect(attempt).rejects.toThrow(ProfileSectionConflictError);
    const stillOnDisk = readFileSync(claudeMdPath(), "utf-8");
    expect(stillOnDisk).toBe(shifted);
    expect(stillOnDisk).not.toContain("New experience text");
  });

  test("the rejected save's error names both the expected and actual heading", async () => {
    const shifted = FIXTURE.replace("## Experience", "## Certifications\n\nSomething.\n\n## Experience");
    writeFileSync(claudeMdPath(), shifted, "utf-8");

    try {
      await updateProfileSection("CLAUDE.md", 3, "Experience", "New experience text");
      throw new Error("expected updateProfileSection to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ProfileSectionConflictError);
      const conflict = err as InstanceType<typeof ProfileSectionConflictError>;
      expect(conflict.expectedHeading).toBe("Experience");
      expect(conflict.actualHeading).toBe("Certifications");
      expect(conflict.message).toContain("Experience");
      expect(conflict.message).toContain("Certifications");
    }
  });

  test("a NaN section index is rejected as a conflict, not silently written to a phantom slot", async () => {
    const attempt = updateProfileSection("CLAUDE.md", Number.NaN, "Skills", "should never land");
    await expect(attempt).rejects.toThrow(ProfileSectionConflictError);

    const stillOnDisk = readFileSync(claudeMdPath(), "utf-8");
    expect(stillOnDisk).toBe(FIXTURE);
  });

  test("an out-of-range index still gives the original, distinct out-of-range error", async () => {
    const attempt = updateProfileSection("CLAUDE.md", 99, "Skills", "irrelevant");
    await expect(attempt).rejects.toThrow(/out of range/);
  });
});

describe("getProfileData -- placeholder scan coverage", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "profile-placeholder-test-"));
    mockPaths.claudeMd = claudeMdPath();
    mockPaths.profileSkillsDir = testDir;
    mockPaths.cvMainExample = path.join(testDir, "cv", "main_example.tex");
    mockPaths.searchQueries = path.join(testDir, "search-queries.md");
    mkdirSync(path.join(testDir, "cv"), { recursive: true });
    writeFileSync(claudeMdPath(), "# Job Application Assistant for Test Candidate\n", "utf-8");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mockPaths.cvMainExample = realPaths.cvMainExample;
    mockPaths.searchQueries = realPaths.searchQueries;
  });

  test("a placeholder left in cv/main_example.tex is reported, not silently missed", async () => {
    writeFileSync(
      mockPaths.cvMainExample,
      "\\name{[YOUR_NAME]}{}\n\\address{[YOUR_ADDRESS]}{}{}\n",
      "utf-8",
    );
    const data = await getProfileData();
    const hits = data.placeholders.filter((p) => p.file === "cv/main_example.tex");
    expect(hits.map((h) => h.match)).toEqual(["[YOUR_NAME]", "[YOUR_ADDRESS]"]);
  });

  test("a placeholder left in search-queries.md is reported, not silently missed", async () => {
    writeFileSync(mockPaths.searchQueries, "- Search for [YOUR_PRIMARY_JOB_TITLE] roles\n", "utf-8");
    const data = await getProfileData();
    const hits = data.placeholders.filter((p) => p.file === "search-queries.md");
    expect(hits.map((h) => h.match)).toEqual(["[YOUR_PRIMARY_JOB_TITLE]"]);
  });

  test("a fully filled-in cv/main_example.tex and search-queries.md contribute no placeholder hits", async () => {
    writeFileSync(mockPaths.cvMainExample, "\\name{Jane}{Doe}\n", "utf-8");
    writeFileSync(mockPaths.searchQueries, "- Search for Software Engineer roles\n", "utf-8");
    const data = await getProfileData();
    expect(data.placeholders.some((p) => p.file === "cv/main_example.tex")).toBe(false);
    expect(data.placeholders.some((p) => p.file === "search-queries.md")).toBe(false);
  });

  test("a missing cv/main_example.tex or search-queries.md is skipped, not an error", async () => {
    const data = await getProfileData();
    expect(data.placeholders.some((p) => p.file === "cv/main_example.tex")).toBe(false);
    expect(data.placeholders.some((p) => p.file === "search-queries.md")).toBe(false);
  });

  test("cv/main_example.tex and search-queries.md are scanned but not returned as editable skillFiles", async () => {
    writeFileSync(mockPaths.cvMainExample, "\\name{[YOUR_NAME]}{}\n", "utf-8");
    writeFileSync(mockPaths.searchQueries, "- [YOUR_PRIMARY_JOB_TITLE]\n", "utf-8");
    const data = await getProfileData();
    expect(data.skillFiles.some((f) => f.filename === "cv/main_example.tex")).toBe(false);
    expect(data.skillFiles.some((f) => f.filename === "search-queries.md")).toBe(false);
  });
});
