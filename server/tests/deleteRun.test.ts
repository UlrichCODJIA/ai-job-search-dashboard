import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { paths } from "../src/lib/paths.js";
import { createRun, deleteThread, getRun } from "../src/lib/runStore.js";
import { deleteRunEvents, emit, getEventLog } from "../src/ws/hub.js";

function testRunId(suffix: string): string {
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

function logFilePath(runId: string): string {
  return path.join(paths.runLogsDir, `${runId}.jsonl`);
}

describe("deleteThread", () => {
  test("removes the root run and every reply in its thread", async () => {
    const rootId = testRunId("1");
    const replyId = testRunId("2");
    const unrelatedId = testRunId("3");

    await createRun({ id: rootId, command: "/apply", status: "completed", startedAt: Date.now() });
    await createRun({
      id: replyId,
      command: "/apply",
      status: "completed",
      startedAt: Date.now(),
      threadRootId: rootId,
    });
    await createRun({ id: unrelatedId, command: "/scrape", status: "completed", startedAt: Date.now() });

    const deleted = await deleteThread(rootId);

    expect(deleted.map((r) => r.id).sort()).toEqual([rootId, replyId].sort());
    expect(await getRun(rootId)).toBeNull();
    expect(await getRun(replyId)).toBeNull();
    expect(await getRun(unrelatedId)).not.toBeNull();

    await deleteThread(unrelatedId);
  });

  test("returns an empty array when the thread doesn't exist", async () => {
    expect(await deleteThread(testRunId("9"))).toEqual([]);
  });
});

describe("deleteRunEvents", () => {
  test("clears the in-memory cache and deletes the log file from disk", async () => {
    const runId = testRunId("4");
    emit(runId, { type: "run_started", runId, command: "/apply" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(existsSync(logFilePath(runId))).toBe(true);

    await deleteRunEvents(runId);

    expect(existsSync(logFilePath(runId))).toBe(false);
    expect(getEventLog(runId)).toEqual([]);
  });

  test("is a no-op (not a throw) when the run never had any events", async () => {
    await deleteRunEvents(testRunId("5"));
  });
});
