import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../src/lib/paths.js";
import { emit, getEventLog, subscribe, unsubscribe } from "../src/ws/hub.js";

// hub.ts validates runId is exactly this shape (randomUUID()'s format) before
// building a filesystem path from it -- these fixtures must comply. Each test
// uses its own dedicated id(s) so module-level state in hub.ts (eventLog,
// subscribers) never bleeds between tests.
function testRunId(suffix: string): string {
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

function logFilePath(runId: string): string {
  return path.join(paths.runLogsDir, `${runId}.jsonl`);
}

const usedIds: string[] = [];
function cleanup() {
  for (const runId of usedIds.splice(0)) {
    const filePath = logFilePath(runId);
    if (existsSync(filePath)) rmSync(filePath);
  }
}

describe("run log persistence", () => {
  afterEach(cleanup);

  test("emit() persists events to a JSONL file on disk", async () => {
    const runId = testRunId("1");
    usedIds.push(runId);
    emit(runId, { type: "run_started", runId, command: "/scrape" });
    emit(runId, { type: "assistant_text", text: "hello" });

    // emit()'s disk write is fire-and-forget; give the microtask queue a turn.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const filePath = logFilePath(runId);
    expect(existsSync(filePath)).toBe(true);
    const lines = readFileSync(filePath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ type: "run_started", runId, command: "/scrape" });
    expect(JSON.parse(lines[1])).toEqual({ type: "assistant_text", text: "hello" });
  });

  test("subscribe() recovers a run's log from disk when it predates this process (server restart)", () => {
    const runId = testRunId("2");
    usedIds.push(runId);
    const events = [
      { type: "run_started", runId, command: "/apply" },
      { type: "assistant_text", text: "Evaluating fit..." },
      { type: "run_result", status: "success" },
    ];
    mkdirSync(paths.runLogsDir, { recursive: true });
    writeFileSync(logFilePath(runId), events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf-8");

    const received: unknown[] = [];
    const fakeSocket = { send: (data: string) => received.push(JSON.parse(data)) };

    // No emit() was ever called for this runId in this process -- this is exactly
    // the state a completed run from a prior server process is left in.
    subscribe(runId, fakeSocket);

    expect(received).toEqual(events);
    expect(getEventLog(runId)).toEqual(events);
  });

  test("emit() after a cache eviction reloads prior history from disk instead of losing it", async () => {
    const runId = testRunId("3");
    usedIds.push(runId);
    // Simulate "this run's in-memory cache entry was evicted, but it's still
    // running and emits again": persist history on disk directly (as a prior
    // emit() call would have), with nothing in the in-memory cache for it.
    const priorEvents = [
      { type: "run_started", runId, command: "/apply" },
      { type: "assistant_text", text: "Evaluating fit..." },
    ];
    mkdirSync(paths.runLogsDir, { recursive: true });
    writeFileSync(logFilePath(runId), priorEvents.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf-8");

    // A fresh emit() for the same run must merge with, not discard, that history.
    emit(runId, { type: "assistant_text", text: "Drafting now." });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const received: unknown[] = [];
    subscribe(runId, { send: (data: string) => received.push(JSON.parse(data)) });
    expect(received).toEqual([...priorEvents, { type: "assistant_text", text: "Drafting now." }]);
  });

  test("eviction skips the oldest run when it still has a live subscriber, evicting the next one instead", async () => {
    const subscribedId = testRunId("4");
    const extraIds = Array.from({ length: 60 }, (_, i) => testRunId(`5${String(i).padStart(3, "0")}`));
    usedIds.push(subscribedId, ...extraIds);

    // subscribedId is the very first (oldest) cache entry and stays subscribed
    // for the rest of this test -- a stand-in for a browser tab left open on it.
    const fakeSocket = { send: () => {} };
    emit(subscribedId, { type: "run_started", runId: subscribedId, command: "/apply" });
    subscribe(subscribedId, fakeSocket);

    // Push 60 more runs through the cache, well past MAX_CACHED_RUN_LOGS (50),
    // which forces eviction to run repeatedly with subscribedId always the
    // oldest entry. The buggy version only ever inspected the single oldest
    // key and gave up for good once it had a subscriber -- that would leave
    // *every* entry, including extraIds[0] below, stuck in the cache forever.
    for (const id of extraIds) {
      emit(id, { type: "assistant_text", text: id });
    }
    // Wait until every emit's fire-and-forget disk write has actually landed
    // (each runId's appendFile is independent, but under full-suite parallel
    // load a fixed short delay isn't reliably enough) before relying on the
    // file existing for the next step.
    const firstExtraLog = logFilePath(extraIds[0]);
    for (let i = 0; i < 100 && !existsSync(firstExtraLog); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(firstExtraLog)).toBe(true);

    // Delete extraIds[0]'s on-disk log directly (bypassing hub.ts) so cache
    // and disk now disagree for it. getEventLog() only returns [] if it's
    // forced to fall back to disk -- i.e. only if it was actually evicted from
    // the in-memory cache. Under the old bug this always finds the still-
    // cached, non-empty entry instead, since eviction never ran again after
    // being blocked once by subscribedId's subscription.
    rmSync(firstExtraLog);
    expect(getEventLog(extraIds[0])).toEqual([]);

    // subscribedId itself must never be evicted while it still has a subscriber.
    rmSync(logFilePath(subscribedId), { force: true });
    expect(getEventLog(subscribedId)).toEqual([
      { type: "run_started", runId: subscribedId, command: "/apply" },
    ]);

    unsubscribe(subscribedId, fakeSocket);
  });
});
