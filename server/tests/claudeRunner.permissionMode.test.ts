import { describe, expect, mock, test } from "bun:test";

let lastOptions: Record<string, unknown> | undefined;

mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: (args: { options: Record<string, unknown> }) => {
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
  },
}));

const { startRun } = await import("../src/lib/claudeRunner.js");
const { getRun } = await import("../src/lib/runStore.js");

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
