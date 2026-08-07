import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

const { getSettings, updateSettings } = await import("../src/lib/settings.js");

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "settings-test-"));
  mockPaths.claudeSettings = path.join(testDir, "settings.json");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function readRawJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(mockPaths.claudeSettings, "utf-8"));
}

describe("getSettings", () => {
  test("returns an empty allow list when settings.json doesn't exist", async () => {
    expect(await getSettings()).toEqual({ allow: [] });
  });

  test("returns an empty allow list when permissions is missing entirely", async () => {
    writeFileSync(mockPaths.claudeSettings, JSON.stringify({ other: "stuff" }));
    expect(await getSettings()).toEqual({ allow: [] });
  });

  test("returns an empty allow list when permissions.allow is not an array", async () => {
    writeFileSync(
      mockPaths.claudeSettings,
      JSON.stringify({ permissions: { allow: "not-an-array" } }),
    );
    expect(await getSettings()).toEqual({ allow: [] });
  });

  test("returns the existing allow array untouched when present", async () => {
    writeFileSync(
      mockPaths.claudeSettings,
      JSON.stringify({ permissions: { allow: ["Read", "Bash(git *)"] } }),
    );
    expect(await getSettings()).toEqual({ allow: ["Read", "Bash(git *)"] });
  });
});

describe("updateSettings", () => {
  test("creates the permissions key when missing, preserving other top-level keys", async () => {
    writeFileSync(mockPaths.claudeSettings, JSON.stringify({ someOtherTopLevelKey: 42 }));
    await updateSettings(["Read"]);
    const raw = readRawJson();
    expect(raw.someOtherTopLevelKey).toBe(42);
    expect(raw.permissions).toEqual({ allow: ["Read"] });
  });

  test("overwrites an existing permissions.allow without disturbing sibling keys under permissions", async () => {
    writeFileSync(
      mockPaths.claudeSettings,
      JSON.stringify({ permissions: { allow: ["Read"], deny: ["Bash(rm *)"] } }),
    );
    await updateSettings(["Read", "Write"]);
    const raw = readRawJson();
    expect(raw.permissions).toEqual({ allow: ["Read", "Write"], deny: ["Bash(rm *)"] });
  });

  test("round-trips: writing then reading returns the same array", async () => {
    const result = await updateSettings(["Read", "Glob", "Bash(bun test)"]);
    expect(result).toEqual({ allow: ["Read", "Glob", "Bash(bun test)"] });
    expect(await getSettings()).toEqual({ allow: ["Read", "Glob", "Bash(bun test)"] });
  });
});
