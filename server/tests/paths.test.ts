import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ORIGINAL_AI_JOB_SEARCH_ROOT = process.env.AI_JOB_SEARCH_ROOT;
const realDashboardConfig = await import("../src/lib/dashboardConfig.js");

let mockSavedConfig: { repoRoot?: string } | null = null;

mock.module("../src/lib/dashboardConfig.js", () => ({
  ...realDashboardConfig,
  readDashboardConfig: () => mockSavedConfig,
}));

function importFreshPaths(): Promise<typeof import("../src/lib/paths.js")> {
  return import(`../src/lib/paths.js?fresh=${Math.random()}`);
}

function makeValidCheckout(dir: string): void {
  writeFileSync(path.join(dir, "CLAUDE.md"), "# profile\n", "utf-8");
  mkdirSync(path.join(dir, ".claude"), { recursive: true });
}

let testDir: string | undefined;

afterEach(() => {
  process.env.AI_JOB_SEARCH_ROOT = ORIGINAL_AI_JOB_SEARCH_ROOT;
  mockSavedConfig = null;
  if (testDir) rmSync(testDir, { recursive: true, force: true });
  testDir = undefined;
});

describe("findRepoRoot / paths module-scope validation", () => {
  test("boots unconfigured (no throw) when AI_JOB_SEARCH_ROOT is unset and no config is saved", async () => {
    delete process.env.AI_JOB_SEARCH_ROOT;
    mockSavedConfig = null;
    const { isConfigured, paths } = await importFreshPaths();
    expect(isConfigured()).toBe(false);
    expect(() => paths.repoRoot).toThrow(/isn't configured yet/);
    expect(() => paths.tracker).toThrow(/isn't configured yet/);
  });

  test("still throws immediately when AI_JOB_SEARCH_ROOT is set but doesn't look like a checkout", async () => {
    testDir = mkdtempSync(path.join(tmpdir(), "paths-test-invalid-"));
    process.env.AI_JOB_SEARCH_ROOT = testDir;
    await expect(importFreshPaths()).rejects.toThrow(
      /doesn't look like an ai-job-search checkout/,
    );
  });

  test("resolves REPO_ROOT and derived paths for a valid checkout via the env var", async () => {
    testDir = mkdtempSync(path.join(tmpdir(), "paths-test-valid-"));
    makeValidCheckout(testDir);
    process.env.AI_JOB_SEARCH_ROOT = testDir;

    const { REPO_ROOT, paths, isConfigured } = await importFreshPaths();
    const resolved = path.resolve(testDir);

    expect(isConfigured()).toBe(true);
    expect(REPO_ROOT).toBe(resolved);
    expect(paths.repoRoot).toBe(resolved);
    expect(paths.seenJobs).toBe(path.join(resolved, "job_scraper", "seen_jobs.json"));
    expect(paths.tracker).toBe(path.join(resolved, "job_search_tracker.csv"));
    expect(paths.salaryData).toBe(path.join(resolved, "salary_data.json"));
    expect(paths.claudeSettings).toBe(path.join(resolved, ".claude", "settings.json"));
  });

  test("falls back to the saved dashboard config when the env var is unset", async () => {
    delete process.env.AI_JOB_SEARCH_ROOT;
    testDir = mkdtempSync(path.join(tmpdir(), "paths-test-config-fallback-"));
    makeValidCheckout(testDir);
    mockSavedConfig = { repoRoot: testDir };

    const { isConfigured, paths } = await importFreshPaths();
    expect(isConfigured()).toBe(true);
    expect(paths.repoRoot).toBe(path.resolve(testDir));
  });

  test("ignores a saved config pointing at an invalid checkout -- stays unconfigured, doesn't throw", async () => {
    delete process.env.AI_JOB_SEARCH_ROOT;
    testDir = mkdtempSync(path.join(tmpdir(), "paths-test-config-invalid-"));
    mockSavedConfig = { repoRoot: testDir };

    const { isConfigured, paths } = await importFreshPaths();
    expect(isConfigured()).toBe(false);
    expect(() => paths.repoRoot).toThrow(/isn't configured yet/);
  });

  test("the env var takes precedence over a saved config when both are present", async () => {
    const envDir = mkdtempSync(path.join(tmpdir(), "paths-test-precedence-env-"));
    const configDir = mkdtempSync(path.join(tmpdir(), "paths-test-precedence-config-"));
    makeValidCheckout(envDir);
    makeValidCheckout(configDir);
    process.env.AI_JOB_SEARCH_ROOT = envDir;
    mockSavedConfig = { repoRoot: configDir };

    try {
      const { paths } = await importFreshPaths();
      expect(paths.repoRoot).toBe(path.resolve(envDir));
    } finally {
      rmSync(envDir, { recursive: true, force: true });
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  test("repoRootHash (embedded in paths.instanceLock) is stable for the same root and differs for a different root", async () => {
    const dirA = mkdtempSync(path.join(tmpdir(), "paths-test-hash-a-"));
    const dirB = mkdtempSync(path.join(tmpdir(), "paths-test-hash-b-"));
    makeValidCheckout(dirA);
    makeValidCheckout(dirB);

    try {
      process.env.AI_JOB_SEARCH_ROOT = dirA;
      const { paths: pathsA1 } = await importFreshPaths();
      const { paths: pathsA2 } = await importFreshPaths();

      process.env.AI_JOB_SEARCH_ROOT = dirB;
      const { paths: pathsB } = await importFreshPaths();

      const hashOf = (p: typeof pathsA1) => path.basename(p.instanceLock).replace("instance-", "");

      expect(hashOf(pathsA1)).toBe(hashOf(pathsA2));
      expect(hashOf(pathsA1)).not.toBe(hashOf(pathsB));
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });
});
