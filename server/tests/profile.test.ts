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

const { updateProfileSection, ProfileSectionConflictError } = await import("../src/lib/profile.js");
const { writeFileSync } = await import("node:fs");

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
