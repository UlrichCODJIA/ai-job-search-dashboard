import { afterEach, describe, expect, test } from "bun:test";
import {
  createRun,
  deleteThread,
  getRun,
  reconcileOrphanedRuns,
} from "../src/lib/runStore.js";

function testRunId(suffix: string): string {
  return `00000000-0000-4000-9200-${suffix.padStart(12, "0")}`;
}

const seededIds: string[] = [];
afterEach(async () => {
  for (const id of seededIds.splice(0)) {
    await deleteThread(id);
  }
});

describe("reconcileOrphanedRuns", () => {
  test("flips only 'running' records to 'error' with a finishedAt and the crash message, leaving others untouched", async () => {
    const runningA = testRunId("1");
    const runningB = testRunId("2");
    const completed = testRunId("3");
    seededIds.push(runningA, runningB, completed);

    await createRun({ id: runningA, command: "/apply", status: "running", startedAt: Date.now() });
    await createRun({ id: runningB, command: "/scrape", status: "running", startedAt: Date.now() });
    await createRun({
      id: completed,
      command: "/apply",
      status: "completed",
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });

    const count = await reconcileOrphanedRuns();
    expect(count).toBeGreaterThanOrEqual(2);

    const reconciledA = await getRun(runningA);
    expect(reconciledA?.status).toBe("error");
    expect(reconciledA?.error).toBe(
      "Interrupted: the dashboard server restarted or crashed while this run was still in progress.",
    );
    expect(reconciledA?.finishedAt).toBeTruthy();

    const reconciledB = await getRun(runningB);
    expect(reconciledB?.status).toBe("error");

    const untouched = await getRun(completed);
    expect(untouched?.status).toBe("completed");
    expect(untouched?.error).toBeUndefined();
  });

  test("returns 0 when nothing is 'running' among a fresh set of records", async () => {
    const id = testRunId("4");
    seededIds.push(id);
    await createRun({
      id,
      command: "/apply",
      status: "stopped",
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });

    await reconcileOrphanedRuns();
    const after = await getRun(id);
    expect(after?.status).toBe("stopped");
  });
});
