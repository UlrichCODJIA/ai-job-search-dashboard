import { afterEach, describe, expect, test } from "bun:test";
import { getQueryCallCount, setStreamFactory } from "./helpers/mockClaudeSdk.js";

const { startRun: realStartRun, stopRun } = await import("../src/lib/claudeRunner.js");
const { getRun, getSessionForKey, deleteThread } = await import("../src/lib/runStore.js");
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

async function waitForSettled(runId: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await getRun(runId);
    if (run && run.status !== "running") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`run ${runId} did not settle within ${timeoutMs}ms`);
}

async function waitFor(
  check: () => Promise<boolean> | boolean,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`condition not met within ${timeoutMs}ms`);
}

function initMessage(sessionId: string) {
  return {
    type: "system",
    subtype: "init",
    session_id: sessionId,
    model: "claude-test",
    tools: [] as string[],
    slash_commands: [] as string[],
  };
}

function resultMessage(isError: boolean) {
  return {
    type: "result",
    is_error: isError,
    result: isError ? undefined : "ok",
    total_cost_usd: 0.01,
    duration_ms: 5,
  };
}

describe("runQuery event translation (happy path)", () => {
  test("assistant text block emits assistant_text with agentID from subagent_type", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-text-1");
        yield {
          type: "assistant",
          subagent_type: "job-scraper",
          message: { content: [{ type: "text", text: "hello from claude" }] },
        };
        yield resultMessage(false);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "assistant_text",
      text: "hello from claude",
      agentID: "job-scraper",
    });
  });

  test("assistant tool_use block emits tool_use with id/name/input/agentID", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-tooluse-1");
        yield {
          type: "assistant",
          subagent_type: undefined,
          message: {
            content: [
              { type: "tool_use", id: "tu-1", name: "Read", input: { file_path: "a.md" } },
            ],
          },
        };
        yield resultMessage(false);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "tool_use",
      toolUseID: "tu-1",
      toolName: "Read",
      input: { file_path: "a.md" },
      agentID: undefined,
    });
  });

  test("tool_result with non-string content is stringified, isError reflects is_error", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-toolresult-1");
        yield {
          type: "user",
          message: {
            content: [
              {
                type: "tool_result",
                tool_use_id: "tu-2",
                content: { ok: true },
                is_error: false,
              },
            ],
          },
        };
        yield resultMessage(false);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "tool_result",
      toolUseID: "tu-2",
      content: JSON.stringify({ ok: true }),
      isError: false,
    });
  });

  test("a tool_result matching the permission-channel-broken pattern emits exactly one such event even if it recurs", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-channelbroken-1");
        for (let i = 0; i < 2; i++) {
          yield {
            type: "user",
            message: {
              content: [
                {
                  type: "tool_result",
                  tool_use_id: `tu-broken-${i}`,
                  content: "Tool permission request failed: AbortError: Stream closed",
                  is_error: true,
                },
              ],
            },
          };
        }
        yield resultMessage(false);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const events = getEventLog(runId);
    const brokenEvents = events.filter((e) => e.type === "permission_channel_broken");
    expect(brokenEvents.length).toBe(1);
  });

  test("an unrecognized SDK message type falls through to the sdk_event catch-all", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-sdkevent-1");
        yield { type: "stream_event", subtype: "something_new", extra: 42 };
        yield resultMessage(false);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "sdk_event",
      subtype: "stream_event",
      raw: { type: "stream_event", subtype: "something_new", extra: 42 },
    });
  });

  test("a result message with is_error: false completes the run and emits run_result status success", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-success-1");
        yield resultMessage(false);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.status).toBe("completed");
    expect(run?.costUsd).toBe(0.01);

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "run_result",
      status: "success",
      result: "ok",
      costUsd: 0.01,
      durationMs: 5,
    });
  });

  test("a result message with is_error: true fails the run and emits run_result status error", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-failure-1");
        yield resultMessage(true);
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.status).toBe("error");

    const events = getEventLog(runId);
    expect(events).toContainEqual({
      type: "run_result",
      status: "error",
      result: undefined,
      costUsd: 0.01,
      durationMs: 5,
    });
  });

  test("a successful run with a resumeKey persists the session id for that key", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-resumekey-1");
        yield resultMessage(false);
      },
    }));

    const resumeKey = "test-resumekey-runquery";
    const runId = await startRun({ command: "/apply", resumeKey });
    await waitForSettled(runId);
    await waitFor(async () => (await getSessionForKey(resumeKey)) !== undefined);

    expect(await getSessionForKey(resumeKey)).toBe("session-resumekey-1");
  });
});

describe("runQuery error and abort handling", () => {
  test("a thrown error from the stream (not an abort) settles the run to status error", async () => {
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-thrown-1");
        throw new Error("boom from the sdk");
      },
    }));

    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.status).toBe("error");
    expect(run?.error).toBe("boom from the sdk");

    const events = getEventLog(runId);
    expect(events).toContainEqual({ type: "run_error", message: "boom from the sdk" });
  });

  test("stopRun on an in-flight run aborts it, returns true, and settles it to status stopped", async () => {
    setStreamFactory(({ abortController }) => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-stop-1");
        await new Promise((_resolve, reject) => {
          abortController.signal.addEventListener(
            "abort",
            () => reject(new Error("Aborted")),
            { once: true },
          );
        });
      },
    }));

    const runId = await startRun({ command: "/apply", args: "continue" });
    await waitFor(async () => (await getRun(runId))?.sessionId === "session-stop-1");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(stopRun(runId)).toBe(true);
    await waitForSettled(runId);

    const run = await getRun(runId);
    expect(run?.status).toBe("stopped");

    const events = getEventLog(runId);
    expect(events.some((e) => e.type === "run_stopped")).toBe(true);
  });

  test("stopRun on an unknown or already-finished run returns false", async () => {
    expect(stopRun("no-such-run-id")).toBe(false);

    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-finished-1");
        yield resultMessage(false);
      },
    }));
    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);

    expect(stopRun(runId)).toBe(false);
  });

  test("two runs resuming the same session id concurrently: the second errors immediately without calling query()", async () => {
    let releaseFirstRun: (() => void) | undefined;
    setStreamFactory(() => ({
      async *[Symbol.asyncIterator]() {
        yield initMessage("session-concurrent-1");
        await new Promise<void>((resolve) => {
          releaseFirstRun = resolve;
        });
        yield resultMessage(false);
      },
    }));

    const sharedSessionId = `concurrent-session-${Date.now()}`;
    const callsBefore = getQueryCallCount();

    const run1Id = await startRun({
      command: "/apply",
      args: "continue",
      resumeSessionId: sharedSessionId,
    });

    const run2Id = await startRun({
      command: "/apply",
      args: "also continue",
      resumeSessionId: sharedSessionId,
    });
    await waitForSettled(run2Id);

    const run2 = await getRun(run2Id);
    expect(run2?.status).toBe("error");
    expect(run2?.error).toBe("session already in use by another run");

    const run2Events = getEventLog(run2Id);
    expect(run2Events).toContainEqual({
      type: "run_error",
      message:
        "This session is already being continued by another run. Wait for it to finish first.",
    });

    expect(getQueryCallCount()).toBe(callsBefore + 1);

    releaseFirstRun?.();
    await waitForSettled(run1Id);
    const run1 = await getRun(run1Id);
    expect(run1?.status).toBe("completed");
  });
});
