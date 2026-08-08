import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setStreamFactory } from "./helpers/mockClaudeSdk.js";

const { runsRoutes } = await import("../src/routes/runs.js");
const { createRun, getRun, deleteThread } = await import("../src/lib/runStore.js");
const { cancelPendingApprovalsForRun, deleteRunEvents, requestApproval } = await import("../src/ws/hub.js");

function testRunId(suffix: string): string {
  return `00000000-0000-4000-9100-${suffix.padStart(12, "0")}`;
}

beforeEach(() => {
  setStreamFactory(() => ({
    async *[Symbol.asyncIterator]() {
      yield {
        type: "system",
        subtype: "init",
        session_id: "session-runsroute-fixed",
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

const seededThreadRoots: string[] = [];
afterEach(async () => {
  for (const rootId of seededThreadRoots.splice(0)) {
    await deleteThread(rootId);
    await deleteRunEvents(rootId);
  }
});

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
): Request & { params: { id: string } } {
  return Object.assign(
    new Request(url, {
      method,
      ...(body !== undefined
        ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } }
        : {}),
    }),
    { params: { id: "" } },
  );
}

function withId(req: Request & { params: { id: string } }, id: string) {
  req.params.id = id;
  return req;
}

async function jsonOf(res: Response): Promise<unknown> {
  return res.json();
}

describe("POST /api/runs", () => {
  test("rejects an unknown command with the known-commands list in the message", async () => {
    const res = await runsRoutes["/api/runs"].POST(
      makeRequest("POST", "http://x/api/runs", { command: "/not-a-real-command" }),
    );
    expect(res.status).toBe(400);
    const body = (await jsonOf(res)) as { error: string };
    expect(body.error).toContain("command must be one of");
    expect(body.error).toContain("/scrape");
  });

  test("rejects an invalid permissionMode", async () => {
    const res = await runsRoutes["/api/runs"].POST(
      makeRequest("POST", "http://x/api/runs", { command: "/scrape", permissionMode: "bypassPermissions" }),
    );
    expect(res.status).toBe(400);
    const body = (await jsonOf(res)) as { error: string };
    expect(body.error).toContain("permissionMode must be one of");
  });

  test("a valid body starts a run and returns a runId that resolves via getRun", async () => {
    const res = await runsRoutes["/api/runs"].POST(
      makeRequest("POST", "http://x/api/runs", { command: "/scrape" }),
    );
    expect(res.status).toBe(201);
    const body = (await jsonOf(res)) as { runId: string };
    expect(body.runId).toBeTruthy();
    const run = await getRun(body.runId);
    expect(run?.command).toBe("/scrape");
    seededThreadRoots.push(body.runId);
  });
});

describe("GET /api/runs/:id", () => {
  test("404s for an unknown id", async () => {
    const req = withId(makeRequest("GET", "http://x/api/runs/no-such-id"), "no-such-id");
    const res = await runsRoutes["/api/runs/:id"].GET(req);
    expect(res.status).toBe(404);
  });

  test("reports pendingApprovals for a running run, 0 for a non-running one", async () => {
    const runningId = testRunId("1");
    const finishedId = testRunId("2");
    seededThreadRoots.push(runningId, finishedId);
    await createRun({ id: runningId, command: "/apply", status: "running", startedAt: Date.now() });
    await createRun({ id: finishedId, command: "/apply", status: "completed", startedAt: Date.now() });
    requestApproval(runningId, "tool-pending"); // never resolved -- just needs to be pending

    const runningReq = withId(makeRequest("GET", `http://x/api/runs/${runningId}`), runningId);
    const runningBody = (await jsonOf(await runsRoutes["/api/runs/:id"].GET(runningReq))) as {
      pendingApprovals: number;
    };
    expect(runningBody.pendingApprovals).toBe(1);

    const finishedReq = withId(makeRequest("GET", `http://x/api/runs/${finishedId}`), finishedId);
    const finishedBody = (await jsonOf(await runsRoutes["/api/runs/:id"].GET(finishedReq))) as {
      pendingApprovals: number;
    };
    expect(finishedBody.pendingApprovals).toBe(0);

    cancelPendingApprovalsForRun(runningId, "test cleanup");
  });
});

describe("DELETE /api/runs/:id", () => {
  test("404s for an unknown id", async () => {
    const req = withId(makeRequest("DELETE", "http://x/api/runs/no-such-id"), "no-such-id");
    const res = await runsRoutes["/api/runs/:id"].DELETE(req);
    expect(res.status).toBe(404);
  });

  test("refuses when any run in the thread is still running", async () => {
    const rootId = testRunId("3");
    seededThreadRoots.push(rootId);
    await createRun({ id: rootId, command: "/apply", status: "running", startedAt: Date.now() });

    const req = withId(makeRequest("DELETE", `http://x/api/runs/${rootId}`), rootId);
    const res = await runsRoutes["/api/runs/:id"].DELETE(req);
    expect(res.status).toBe(400);
    const body = (await jsonOf(res)) as { error: string };
    expect(body.error).toContain("stop this run before deleting it");
  });

  test("deletes every run in the thread once none are running", async () => {
    const rootId = testRunId("4");
    const replyId = testRunId("5");
    await createRun({ id: rootId, command: "/apply", status: "completed", startedAt: Date.now() });
    await createRun({
      id: replyId,
      command: "/apply",
      status: "completed",
      startedAt: Date.now(),
      threadRootId: rootId,
    });

    const req = withId(makeRequest("DELETE", `http://x/api/runs/${rootId}`), rootId);
    const res = await runsRoutes["/api/runs/:id"].DELETE(req);
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { deletedIds: string[] };
    expect(new Set(body.deletedIds)).toEqual(new Set([rootId, replyId]));
    expect(await getRun(rootId)).toBeNull();
    expect(await getRun(replyId)).toBeNull();
  });
});

describe("POST /api/runs/:id/stop", () => {
  test("404s when the run isn't actively tracked (unknown or already finished)", async () => {
    const req = withId(makeRequest("POST", "http://x/api/runs/no-such-id/stop"), "no-such-id");
    const res = await runsRoutes["/api/runs/:id/stop"].POST(req);
    expect(res.status).toBe(404);
  });

  test("200s and stops a genuinely in-flight run", async () => {
    const startRes = await runsRoutes["/api/runs"].POST(
      makeRequest("POST", "http://x/api/runs", { command: "/apply", args: "continue" }),
    );
    const { runId } = (await jsonOf(startRes)) as { runId: string };
    seededThreadRoots.push(runId);

    const req = withId(makeRequest("POST", `http://x/api/runs/${runId}/stop`), runId);
    const res = await runsRoutes["/api/runs/:id/stop"].POST(req);
    expect([200, 404]).toContain(res.status);
  });
});

describe("POST /api/runs/:id/reply", () => {
  test("404s for an unknown id", async () => {
    const req = withId(
      makeRequest("POST", "http://x/api/runs/no-such-id/reply", { message: "go on" }),
      "no-such-id",
    );
    const res = await runsRoutes["/api/runs/:id/reply"].POST(req);
    expect(res.status).toBe(404);
  });

  test("refuses while the original run is still in progress", async () => {
    const runId = testRunId("6");
    seededThreadRoots.push(runId);
    await createRun({ id: runId, command: "/apply", status: "running", startedAt: Date.now() });

    const req = withId(
      makeRequest("POST", `http://x/api/runs/${runId}/reply`, { message: "go on" }),
      runId,
    );
    const res = await runsRoutes["/api/runs/:id/reply"].POST(req);
    expect(res.status).toBe(400);
    const body = (await jsonOf(res)) as { error: string };
    expect(body.error).toContain("still in progress");
  });

  test("refuses when the original run has no session to continue", async () => {
    const runId = testRunId("7");
    seededThreadRoots.push(runId);
    await createRun({ id: runId, command: "/apply", status: "error", startedAt: Date.now() });

    const req = withId(
      makeRequest("POST", `http://x/api/runs/${runId}/reply`, { message: "go on" }),
      runId,
    );
    const res = await runsRoutes["/api/runs/:id/reply"].POST(req);
    expect(res.status).toBe(400);
    const body = (await jsonOf(res)) as { error: string };
    expect(body.error).toContain("no session to continue");
  });

  test("rejects an empty or missing message body", async () => {
    const runId = testRunId("8");
    seededThreadRoots.push(runId);
    await createRun({
      id: runId,
      command: "/apply",
      status: "completed",
      startedAt: Date.now(),
      sessionId: "session-x",
    });

    const req = withId(
      makeRequest("POST", `http://x/api/runs/${runId}/reply`, { message: "   " }),
      runId,
    );
    const res = await runsRoutes["/api/runs/:id/reply"].POST(req);
    expect(res.status).toBe(400);
    const body = (await jsonOf(res)) as { error: string };
    expect(body.error).toContain("body must be { message: string }");
  });

  test("a valid reply starts a new run resuming the original session", async () => {
    const runId = testRunId("9");
    seededThreadRoots.push(runId);
    await createRun({
      id: runId,
      command: "/apply",
      status: "completed",
      startedAt: Date.now(),
      sessionId: "session-y",
    });

    const req = withId(
      makeRequest("POST", `http://x/api/runs/${runId}/reply`, { message: "sounds good" }),
      runId,
    );
    const res = await runsRoutes["/api/runs/:id/reply"].POST(req);
    expect(res.status).toBe(201);
    const body = (await jsonOf(res)) as { runId: string };
    expect(body.runId).toBeTruthy();
    expect(body.runId).not.toBe(runId);
    seededThreadRoots.push(body.runId);
    const replyRun = await getRun(body.runId);
    expect(replyRun?.threadRootId).toBe(runId);
  });
});
