import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths } from "./helpers/mockPaths.js";

const { acquireInstanceLock, AnotherInstanceRunningError } = await import(
  "../src/lib/instanceLock.js"
);

const DEAD_PID = 999_999_999;

let testDir: string;
let lockFile: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "instance-lock-test-"));
  mockPaths.instanceLock = path.join(testDir, "instance");
  lockFile = `${mockPaths.instanceLock}.lock`;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  process.removeAllListeners("exit");
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
});

describe("acquireInstanceLock", () => {
  test("succeeds and creates the lock file when nothing is running yet", async () => {
    await acquireInstanceLock();
    expect(existsSync(lockFile)).toBe(true);
  });

  test("rejects with a clear, actionable error when a live instance already holds the lock", async () => {
    writeFileSync(lockFile, String(process.pid), "utf-8");
    const attempt = acquireInstanceLock();
    await expect(attempt).rejects.toThrow(AnotherInstanceRunningError);
    await expect(attempt).rejects.toThrow(String(process.pid));
    await expect(attempt).rejects.toThrow(mockPaths.repoRoot);
  });

  test("reclaims a lock left behind by a crashed (no longer running) instance", async () => {
    writeFileSync(lockFile, String(DEAD_PID), "utf-8");
    await acquireInstanceLock();
    const content = await Bun.file(lockFile).text();
    expect(content).toBe(String(process.pid));
  });

  test("cleans up the lock file when the process's exit handler fires", async () => {
    await acquireInstanceLock();
    expect(existsSync(lockFile)).toBe(true);
    process.emit("exit", 0);
    expect(existsSync(lockFile)).toBe(false);
  });
});
