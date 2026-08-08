import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isConfigured, paths } from "../src/lib/paths.js";
import { setupRoutes } from "../src/routes/setup.js";

const CONFIG_PATH = path.join(
  path.resolve(import.meta.dir, "..", ".."),
  "server",
  ".dashboard-config.json",
);

let preexistingConfig: string | null = null;
let testDir: string | undefined;

afterEach(() => {
  if (preexistingConfig !== null) {
    writeFileSync(CONFIG_PATH, preexistingConfig, "utf-8");
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }
  preexistingConfig = null;
  if (testDir) rmSync(testDir, { recursive: true, force: true });
  testDir = undefined;
});

function makeCheckoutDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "setup-route-test-"));
  writeFileSync(path.join(dir, "CLAUDE.md"), "# profile\n", "utf-8");
  mkdirSync(path.join(dir, ".claude"), { recursive: true });
  return dir;
}

describe("GET /api/setup", () => {
  test("reflects the real, already-configured test environment", async () => {
    const res = await setupRoutes["/api/setup"].GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configured: boolean; repoRoot: string | null };
    expect(body).toEqual({ configured: isConfigured(), repoRoot: paths.repoRoot });
  });
});

describe("POST /api/setup", () => {
  test("rejects a missing repoRoot", async () => {
    const existedBefore = existsSync(CONFIG_PATH);
    const res = await setupRoutes["/api/setup"].POST(
      new Request("http://x/api/setup", { method: "POST", body: JSON.stringify({}) }),
    );
    expect(res.status).toBe(400);
    expect(existsSync(CONFIG_PATH)).toBe(existedBefore);
  });

  test("rejects a blank repoRoot", async () => {
    const existedBefore = existsSync(CONFIG_PATH);
    const res = await setupRoutes["/api/setup"].POST(
      new Request("http://x/api/setup", { method: "POST", body: JSON.stringify({ repoRoot: "   " }) }),
    );
    expect(res.status).toBe(400);
    expect(existsSync(CONFIG_PATH)).toBe(existedBefore);
  });

  test("rejects a path that doesn't look like an ai-job-search checkout", async () => {
    const existedBefore = existsSync(CONFIG_PATH);
    testDir = mkdtempSync(path.join(tmpdir(), "setup-route-test-invalid-"));
    const res = await setupRoutes["/api/setup"].POST(
      new Request("http://x/api/setup", {
        method: "POST",
        body: JSON.stringify({ repoRoot: testDir }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("doesn't look like an ai-job-search checkout");
    expect(existsSync(CONFIG_PATH)).toBe(existedBefore);
  });

  test("saves a valid checkout path and returns it", async () => {
    preexistingConfig = existsSync(CONFIG_PATH) ? readFileSync(CONFIG_PATH, "utf-8") : null;
    testDir = makeCheckoutDir();
    const res = await setupRoutes["/api/setup"].POST(
      new Request("http://x/api/setup", {
        method: "POST",
        body: JSON.stringify({ repoRoot: testDir }),
      }),
    );
    expect(res.status).toBe(200);
    const resolved = path.resolve(testDir);
    expect(await res.json()).toEqual({ saved: true, repoRoot: resolved });
    expect(JSON.parse(readFileSync(CONFIG_PATH, "utf-8"))).toEqual({ repoRoot: resolved });
  });
});
