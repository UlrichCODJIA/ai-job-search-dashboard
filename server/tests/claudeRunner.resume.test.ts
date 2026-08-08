import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setStreamFactory } from "./helpers/mockClaudeSdk.js";

let nextSessionId = "";

beforeEach(() => {
  setStreamFactory(() => ({
    async *[Symbol.asyncIterator]() {
      yield {
        type: "system",
        subtype: "init",
        session_id: nextSessionId,
        model: "claude-test",
        tools: [] as string[],
        slash_commands: [] as string[],
      };
      yield {
        type: "result",
        is_error: false,
        result: "ok",
        total_cost_usd: 0,
        duration_ms: 1,
      };
    },
  }));
});

const { startRun: realStartRun } = await import("../src/lib/claudeRunner.js");
const { getRun, deleteThread } = await import("../src/lib/runStore.js");
const { getEventLog, deleteRunEvents } = await import("../src/ws/hub.js");

const createdRunIds: string[] = [];
async function startRun(...args: Parameters<typeof realStartRun>): ReturnType<typeof realStartRun> {
  const runId = await realStartRun(...args);
  createdRunIds.push(runId);
  return runId;
}
afterEach(async () => {
  for (const runId of createdRunIds.splice(0)) {
    await deleteThread(runId);
    await deleteRunEvents(runId);
  }
});

async function waitForSettled(runId: string, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await getRun(runId);
    if (run && run.status !== "running") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`run ${runId} did not settle within ${timeoutMs}ms`);
}

describe("silent resume-failure detection", () => {
  test("matching session id: resumeFailed is never set, no resume_failed event", async () => {
    nextSessionId = "session-match-1";
    const runId = await startRun({
      command: "/apply",
      args: "continue please",
      resumeSessionId: "session-match-1",
    });
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.sessionId).toBe("session-match-1");
    expect(run?.resumeFailed).toBeUndefined();

    const events = getEventLog(runId);
    expect(events.some((e) => e.type === "resume_failed")).toBe(false);
  });

  test("mismatched session id: resumeFailed is set and resume_failed carries both ids", async () => {
    nextSessionId = "session-actual-2";
    const runId = await startRun({
      command: "/apply",
      args: "continue please",
      resumeSessionId: "session-requested-2",
    });
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.sessionId).toBe("session-actual-2");
    expect(run?.resumeFailed).toBe(true);

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "resume_failed",
      requestedSessionId: "session-requested-2",
      actualSessionId: "session-actual-2",
    });
  });

  test("a fresh run (no resume requested) is never flagged, regardless of the session id it gets", async () => {
    nextSessionId = "brand-new-session-3";
    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.sessionId).toBe("brand-new-session-3");
    expect(run?.resumeFailed).toBeUndefined();

    const events = getEventLog(runId);
    expect(events.some((e) => e.type === "resume_failed")).toBe(false);
  });
});
