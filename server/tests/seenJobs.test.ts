import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths } from "./helpers/mockPaths.js";

const { listScrapedJobs, updateScrapedJob } = await import("../src/lib/seenJobs.js");

const baseJob = {
  title: "Software Engineer",
  company: "Acme",
  url: "https://example.com/jobs/acme-swe",
  first_seen: "2026-01-01",
  fit: "medium",
  status: "new",
};

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "seen-jobs-test-"));
  mockPaths.seenJobs = path.join(testDir, "seen_jobs.json");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("listScrapedJobs", () => {
  test("returns [] when seen_jobs.json doesn't exist yet", async () => {
    expect(await listScrapedJobs()).toEqual([]);
  });

  test("flattens the keyed 'seen' map into an array, injecting the key back in as 'key'", async () => {
    writeFileSync(
      mockPaths.seenJobs,
      JSON.stringify({ seen: { "acme-swe": baseJob } }),
      "utf-8",
    );
    expect(await listScrapedJobs()).toEqual([{ key: "acme-swe", ...baseJob }]);
  });
});

describe("updateScrapedJob", () => {
  test("returns null for a key that isn't in the file", async () => {
    writeFileSync(mockPaths.seenJobs, JSON.stringify({ seen: {} }), "utf-8");
    expect(await updateScrapedJob("no-such-key", { status: "skipped" })).toBeNull();
  });

  test("merges the patch into the existing entry and persists it", async () => {
    writeFileSync(
      mockPaths.seenJobs,
      JSON.stringify({ seen: { "acme-swe": baseJob } }),
      "utf-8",
    );

    const updated = await updateScrapedJob("acme-swe", { status: "skipped" });
    expect(updated).toEqual({ key: "acme-swe", ...baseJob, status: "skipped" });

    const jobs = await listScrapedJobs();
    expect(jobs).toEqual([{ key: "acme-swe", ...baseJob, status: "skipped" }]);
  });
});
