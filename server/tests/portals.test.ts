import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

const { listPortalSkills, setPortalEnabled } = await import("../src/lib/portals.js");

function writeSkill(name: string, extraFrontmatter = ""): void {
  const dir = path.join(testDir, "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "SKILL.md"),
    [
      "---",
      `name: ${name}`,
      `description: >`,
      `  Searches ${name} for jobs.`,
      extraFrontmatter,
      "---",
      "",
      `# ${name}`,
    ]
      .filter(Boolean)
      .join("\n"),
    "utf-8",
  );
}

describe("listPortalSkills -- health merge", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "portals-test-"));
    mockPaths.agentSkillsDir = path.join(testDir, "skills");
    mockPaths.portalHealth = path.join(testDir, "portal_health.json");
    mkdirSync(mockPaths.agentSkillsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("a portal with a health record merges lastChecked/lastResultCount/healthStatus", async () => {
    writeSkill("acme-search");
    writeFileSync(
      mockPaths.portalHealth,
      JSON.stringify({
        portals: {
          "acme-search": { last_checked: "2026-08-01", last_result_count: 12, status: "ok" },
        },
      }),
      "utf-8",
    );

    const skills = await listPortalSkills();
    const acme = skills.find((s) => s.name === "acme-search");
    expect(acme).toMatchObject({
      lastChecked: "2026-08-01",
      lastResultCount: 12,
      healthStatus: "ok",
    });
  });

  test("a portal with no health record yet leaves the fields undefined, not an error", async () => {
    writeSkill("brandnew-search");
    // No portal_health.json written at all.

    const skills = await listPortalSkills();
    const brandnew = skills.find((s) => s.name === "brandnew-search");
    expect(brandnew?.lastChecked).toBeUndefined();
    expect(brandnew?.lastResultCount).toBeUndefined();
    expect(brandnew?.healthStatus).toBeUndefined();
  });

  test("a malformed portal_health.json is treated as no data, not a crash", async () => {
    writeSkill("acme-search");
    writeFileSync(mockPaths.portalHealth, "{ not valid json", "utf-8");

    const skills = await listPortalSkills();
    expect(skills.find((s) => s.name === "acme-search")?.healthStatus).toBeUndefined();
  });

  test("zero_results and error statuses both surface distinctly", async () => {
    writeSkill("quiet-search");
    writeSkill("broken-search");
    writeFileSync(
      mockPaths.portalHealth,
      JSON.stringify({
        portals: {
          "quiet-search": { last_checked: "2026-08-01", last_result_count: 0, status: "zero_results" },
          "broken-search": { last_checked: "2026-08-01", last_result_count: 0, status: "error" },
        },
      }),
      "utf-8",
    );

    const skills = await listPortalSkills();
    expect(skills.find((s) => s.name === "quiet-search")?.healthStatus).toBe("zero_results");
    expect(skills.find((s) => s.name === "broken-search")?.healthStatus).toBe("error");
  });

  test("a disabled portal keeps its own recorded skipped_disabled status", async () => {
    writeSkill("disabled-search", "enabled: false");
    writeFileSync(
      mockPaths.portalHealth,
      JSON.stringify({
        portals: {
          "disabled-search": { last_checked: "2026-08-01", last_result_count: 0, status: "skipped_disabled" },
        },
      }),
      "utf-8",
    );

    const skills = await listPortalSkills();
    const disabled = skills.find((s) => s.name === "disabled-search");
    expect(disabled?.enabled).toBe(false);
    expect(disabled?.healthStatus).toBe("skipped_disabled");
  });
});

describe("setPortalEnabled", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "portals-toggle-test-"));
    mockPaths.agentSkillsDir = path.join(testDir, "skills");
    mockPaths.portalHealth = path.join(testDir, "portal_health.json");
    mkdirSync(mockPaths.agentSkillsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function skillPath(name: string): string {
    return path.join(mockPaths.agentSkillsDir, name, "SKILL.md");
  }

  test("disabling a portal with no existing enabled field inserts one", async () => {
    writeSkill("acme-search");

    await setPortalEnabled("acme-search", false);

    const skills = await listPortalSkills();
    expect(skills.find((s) => s.name === "acme-search")?.enabled).toBe(false);
  });

  test("re-enabling a portal that already has enabled: false flips it in place", async () => {
    writeSkill("acme-search", "enabled: false");

    await setPortalEnabled("acme-search", true);

    const skills = await listPortalSkills();
    expect(skills.find((s) => s.name === "acme-search")?.enabled).toBe(true);
    // Exactly one enabled: line should remain, not a duplicate appended alongside it.
    const raw = readFileSync(skillPath("acme-search"), "utf-8");
    expect(raw.match(/^enabled:/gm)?.length).toBe(1);
  });

  test("every other frontmatter field and the body are preserved untouched", async () => {
    writeSkill("acme-search");
    const before = readFileSync(skillPath("acme-search"), "utf-8");

    await setPortalEnabled("acme-search", false);

    const after = readFileSync(skillPath("acme-search"), "utf-8");
    expect(after).toContain("name: acme-search");
    expect(after).toContain("Searches acme-search for jobs.");
    expect(after).toContain("# acme-search");
    // Only the frontmatter block should have changed (one new "enabled" line).
    expect(after.length).toBeGreaterThan(before.length);
  });

  test("throws for a portal name that doesn't resolve to any skill directory", async () => {
    writeSkill("acme-search");
    await expect(setPortalEnabled("does-not-exist", false)).rejects.toThrow(
      /portal not found/,
    );
  });

  test("resolves by the frontmatter name field, not the directory name", async () => {
    const dir = path.join(mockPaths.agentSkillsDir, "dir-name-differs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "SKILL.md"),
      ["---", "name: friendly-name", "description: >", "  Searches.", "---", "", "# body"].join(
        "\n",
      ),
      "utf-8",
    );

    await setPortalEnabled("friendly-name", false);

    const skills = await listPortalSkills();
    expect(skills.find((s) => s.name === "friendly-name")?.enabled).toBe(false);
  });
});
