import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setStreamFactory } from "./helpers/mockClaudeSdk.js";

let lastOptions: Record<string, unknown> | undefined;

beforeEach(() => {
  setStreamFactory((args) => {
    lastOptions = args.options;
    return {
      async *[Symbol.asyncIterator]() {
        yield {
          type: "system",
          subtype: "init",
          session_id: "session-permissionmode",
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
    };
  });
});

const { startRun: realStartRun } = await import("../src/lib/claudeRunner.js");
const { getRun, deleteThread } = await import("../src/lib/runStore.js");
const { deleteRunEvents } = await import("../src/ws/hub.js");

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

describe("permissionMode threading", () => {
  test("omitting permissionMode defaults the SDK call to 'default'", async () => {
    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);
    expect(lastOptions?.permissionMode).toBe("default");
  });

  test("requesting acceptEdits passes it through to the SDK call", async () => {
    const runId = await startRun({
      command: "/apply",
      permissionMode: "acceptEdits",
    });
    await waitForSettled(runId);
    expect(lastOptions?.permissionMode).toBe("acceptEdits");
  });

  test("the run record itself persists the requested permissionMode", async () => {
    const runId = await startRun({
      command: "/apply",
      permissionMode: "acceptEdits",
    });
    await waitForSettled(runId);
    const run = await getRun(runId);
    expect(run?.permissionMode).toBe("acceptEdits");
  });

  test("the run record leaves permissionMode undefined when not requested", async () => {
    const runId = await startRun({ command: "/scrape" });
    await waitForSettled(runId);
    const run = await getRun(runId);
    expect(run?.permissionMode).toBeUndefined();
  });
});
