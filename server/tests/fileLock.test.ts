import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, utimesSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { acquireFileLock, withFileLock } from "../src/lib/fs.js";

const DEAD_PID = 999_999_999;

let testDir: string;
let target: string;
let lockPath: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "filelock-test-"));
  target = path.join(testDir, "data.csv");
  lockPath = `${target}.lock`;
  writeFileSync(target, "original", "utf-8");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("acquireFileLock", () => {
  test("creates a sibling `<file>.lock` containing this process's pid, and release() removes it", async () => {
    const release = await acquireFileLock(target);
    expect(existsSync(lockPath)).toBe(true);
    await release();
    expect(existsSync(lockPath)).toBe(false);
  });

  test("the lock is reusable after release -- a second acquire on the same path succeeds immediately", async () => {
    const release1 = await acquireFileLock(target);
    await release1();
    const release2 = await acquireFileLock(target, { maxWaitMs: 0, retryMs: 0 });
    expect(existsSync(lockPath)).toBe(true);
    await release2();
  });

  test("a lock left behind by a dead process is reclaimed immediately, not treated as held", async () => {
    writeFileSync(lockPath, String(DEAD_PID), "utf-8");
    const start = Date.now();
    const release = await acquireFileLock(target, { maxWaitMs: 200, retryMs: 20 });
    expect(Date.now() - start).toBeLessThan(200);
    const content = await Bun.file(lockPath).text();
    expect(content).toBe(String(process.pid));
    await release();
  });

  test("an old lock is reclaimed on age alone, even if its owning pid is alive", async () => {
    writeFileSync(lockPath, String(process.pid), "utf-8");
    const oldTime = new Date(Date.now() - 60_000);
    utimesSync(lockPath, oldTime, oldTime);

    const release = await acquireFileLock(target, { staleMs: 1_000, maxWaitMs: 200, retryMs: 20 });
    expect(existsSync(lockPath)).toBe(true);
    await release();
  });

  test("a fresh lock held by a live process is NOT reclaimed -- the caller waits and then times out", async () => {
    writeFileSync(lockPath, String(process.pid), "utf-8");
    const attempt = acquireFileLock(target, { staleMs: 60_000, maxWaitMs: 150, retryMs: 20 });
    await expect(attempt).rejects.toThrow(/timed out/i);
    expect(existsSync(lockPath)).toBe(true);
  });

  test("a second acquire for the same path waits until the first is released, then succeeds", async () => {
    const release1 = await acquireFileLock(target);
    let secondAcquired = false;
    const secondAttempt = acquireFileLock(target, { maxWaitMs: 2_000, retryMs: 20 }).then(
      (release2) => {
        secondAcquired = true;
        return release2;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(secondAcquired).toBe(false);

    await release1();
    const release2 = await secondAttempt;
    expect(secondAcquired).toBe(true);
    await release2();
  });
});

describe("withFileLock", () => {
  test("runs the callback and returns its result under no contention", async () => {
    const result = await withFileLock(target, async () => "done");
    expect(result).toBe("done");
    expect(existsSync(lockPath)).toBe(false);
  });

  test("same-process calls still serialize in call order (existing in-process guarantee preserved)", async () => {
    const order: number[] = [];
    await Promise.all([
      withFileLock(target, async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        order.push(1);
      }),
      withFileLock(target, async () => {
        order.push(2);
      }),
    ]);
    expect(order).toEqual([1, 2]);
  });

  test("one call throwing does not deadlock a subsequent call on the same path", async () => {
    await expect(
      withFileLock(target, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await withFileLock(target, async () => "recovered");
    expect(result).toBe("recovered");
  });
});
