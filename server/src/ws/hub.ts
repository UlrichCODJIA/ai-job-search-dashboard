import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "../lib/paths.js";

export interface RunEvent {
  type: string;
  [key: string]: unknown;
}

export interface ApprovalDecision {
  approved: boolean;
  message?: string;
}

interface PendingApproval {
  resolve: (decision: ApprovalDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

const subscribers = new Map<string, Set<{ send: (data: string) => void }>>();
const eventLog = new Map<string, RunEvent[]>();
const pendingApprovals = new Map<string, PendingApproval>();

// eventLog holds full transcripts (assistant text, tool inputs/outputs) forever
// otherwise -- unbounded for the life of the process across every run ever
// started. Since every event is now also persisted to disk (see below), it's
// safe to cap how many runs' transcripts stay in memory and let subscribe()'s
// existing disk fallback rehydrate an evicted run on the next reconnect.
const MAX_CACHED_RUN_LOGS = 50;

function touchEventLogCache(runId: string, events: RunEvent[]): void {
  eventLog.delete(runId); // re-inserting moves it to the end (most-recently-used)
  eventLog.set(runId, events);
  if (eventLog.size <= MAX_CACHED_RUN_LOGS) return;
  // Walk from oldest looking for the first entry with no live subscriber --
  // NOT just the single oldest key. A run left open in a browser tab is always
  // subscribed, and checking only the very oldest key would let that one run
  // permanently block eviction for everything behind it once it aged to the
  // front, silently defeating the cap for the rest of the process's lifetime.
  for (const candidateId of eventLog.keys()) {
    if (candidateId === runId) continue; // never evict what was just touched
    if (!subscribers.get(candidateId)?.size) {
      eventLog.delete(candidateId);
      return;
    }
  }
}

// The in-memory eventLog above is lost on every server restart, even though a
// run's metadata survives in runs.json (runStore.ts) -- that left completed
// runs from a prior server process permanently stuck at "Waiting for output..."
// with no way to review what the agent actually did. Persisting each event as
// one JSONL line lets a restarted server rehydrate a run's log from disk on
// first reconnect, same as its metadata already does.
mkdirSync(paths.runLogsDir, { recursive: true });

// randomUUID() (runStore.ts) is the only thing that ever mints a runId, and
// this module turns one into a filesystem path (logFilePath) -- validating
// the shape here, at the operation that's actually dangerous, means that
// guarantee travels with logFilePath instead of depending on every caller
// (today just the WS upgrade handler in index.ts) remembering to check first.
const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function logFilePath(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`invalid runId: ${runId}`);
  }
  return path.join(paths.runLogsDir, `${runId}.jsonl`);
}

// Per-run promise chain so appends for the same run always land in emitted
// order, without forcing emit() callers to await the disk write. Deleted once
// a run's chain settles (mirroring subscribers' cleanup below) so this map
// doesn't grow by one entry for every run ever started over the process's life.
const writeQueues = new Map<string, Promise<void>>();

function persistEvent(runId: string, payload: string): void {
  const next = (writeQueues.get(runId) ?? Promise.resolve())
    .then(() => appendFile(logFilePath(runId), `${payload}\n`, "utf-8"))
    .catch((err) => {
      console.error(`Failed to persist run event for ${runId}:`, err);
    })
    .then(() => {
      // Only clear the entry if nothing queued behind us in the meantime.
      if (writeQueues.get(runId) === next) writeQueues.delete(runId);
    });
  writeQueues.set(runId, next);
}

function loadEventLogFromDisk(runId: string): RunEvent[] {
  const filePath = logFilePath(runId);
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf-8").split("\n").filter((line) => line.trim());
  const events: RunEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as RunEvent);
    } catch {
      // Skip a malformed/truncated trailing line rather than losing the whole log.
    }
  }
  return events;
}

/** Subscribes a socket to a run's event stream, replaying buffered history first
 * so a browser that connects late (or reloads mid-run) catches up immediately.
 * Falls back to the on-disk log when this run predates the current server
 * process (eventLog is in-memory only and doesn't survive a restart). */
export function subscribe(runId: string, ws: { send: (data: string) => void }): void {
  if (!subscribers.has(runId)) subscribers.set(runId, new Set());
  subscribers.get(runId)!.add(ws);
  let events = eventLog.get(runId);
  if (!events) {
    events = loadEventLogFromDisk(runId);
    touchEventLogCache(runId, events);
  }
  for (const event of events) {
    ws.send(JSON.stringify(event));
  }
}

export function unsubscribe(runId: string, ws: { send: (data: string) => void }): void {
  const set = subscribers.get(runId);
  if (!set) return;
  set.delete(ws);
  // Otherwise an empty Set for this runId lives in the map forever -- the
  // dashboard is a long-running local process, and every run ever opened would
  // leak one permanently-empty Set for the rest of the process's lifetime.
  if (set.size === 0) subscribers.delete(runId);
}

export function emit(runId: string, event: RunEvent): void {
  // Reload from disk on a cache miss instead of starting a fresh array -- a run
  // whose in-memory log was evicted (see touchEventLogCache) but is still
  // running and emits again must not silently lose everything before the
  // eviction. persistEvent() only ever appends, so disk is always the
  // complete history; this keeps the in-memory copy consistent with it.
  const events = eventLog.get(runId) ?? loadEventLogFromDisk(runId);
  events.push(event);
  touchEventLogCache(runId, events);
  const payload = JSON.stringify(event);
  persistEvent(runId, payload);
  for (const ws of subscribers.get(runId) ?? []) {
    ws.send(payload);
  }
}

export function getEventLog(runId: string): RunEvent[] {
  const cached = eventLog.get(runId);
  if (cached) return cached;
  const events = loadEventLogFromDisk(runId);
  touchEventLogCache(runId, events);
  return events;
}

/** Pauses until the browser sends approve/deny for this tool call, or auto-denies
 * after 5 minutes so an abandoned browser tab can never hang a run indefinitely. */
export function requestApproval(runId: string, toolUseID: string): Promise<ApprovalDecision> {
  return new Promise((resolve) => {
    const key = `${runId}:${toolUseID}`;
    const timeout = setTimeout(() => {
      pendingApprovals.delete(key);
      resolve({ approved: false, message: "Auto-denied: no response within 5 minutes." });
    }, APPROVAL_TIMEOUT_MS);
    pendingApprovals.set(key, { resolve, timeout });
  });
}

export function resolveApproval(
  runId: string,
  toolUseID: string,
  approved: boolean,
  message?: string,
): boolean {
  const key = `${runId}:${toolUseID}`;
  const pending = pendingApprovals.get(key);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  pendingApprovals.delete(key);
  pending.resolve({ approved, message });
  return true;
}

/** Lets the runs list surface a "needs approval" badge without every viewer
 * having to open a WebSocket to each run just to know one is waiting. */
export function getPendingApprovalCount(runId: string): number {
  const prefix = `${runId}:`;
  let count = 0;
  for (const key of pendingApprovals.keys()) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
}

/** Stopping a run shouldn't leave a tool call parked waiting for an approval
 * that will now never come -- deny every pending request for this run so it
 * unblocks immediately instead of idling until the 5-minute auto-deny. */
export function cancelPendingApprovalsForRun(runId: string, message: string): void {
  const prefix = `${runId}:`;
  for (const [key, pending] of pendingApprovals.entries()) {
    if (!key.startsWith(prefix)) continue;
    clearTimeout(pending.timeout);
    pendingApprovals.delete(key);
    pending.resolve({ approved: false, message });
  }
}
