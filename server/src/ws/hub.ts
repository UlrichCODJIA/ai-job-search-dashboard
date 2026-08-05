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

export interface QuestionDecision {
  answered: boolean;
  answers?: Record<string, string | string[]>;
  message?: string;
}

interface PendingApproval {
  resolve: (decision: ApprovalDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingQuestion {
  resolve: (decision: QuestionDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

const subscribers = new Map<string, Set<{ send: (data: string) => void }>>();
const eventLog = new Map<string, RunEvent[]>();
const pendingApprovals = new Map<string, PendingApproval>();
const pendingQuestions = new Map<string, PendingQuestion>();

const MAX_CACHED_RUN_LOGS = 50;

function touchEventLogCache(runId: string, events: RunEvent[]): void {
  eventLog.delete(runId); // re-inserting moves it to the end (most-recently-used)
  eventLog.set(runId, events);
  if (eventLog.size <= MAX_CACHED_RUN_LOGS) return;
  for (const candidateId of eventLog.keys()) {
    if (candidateId === runId) continue; // never evict what was just touched
    if (!subscribers.get(candidateId)?.size) {
      eventLog.delete(candidateId);
      return;
    }
  }
}

mkdirSync(paths.runLogsDir, { recursive: true });

const RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function logFilePath(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`invalid runId: ${runId}`);
  }
  return path.join(paths.runLogsDir, `${runId}.jsonl`);
}

const writeQueues = new Map<string, Promise<void>>();

function persistEvent(runId: string, payload: string): void {
  const next = (writeQueues.get(runId) ?? Promise.resolve())
    .then(() => appendFile(logFilePath(runId), `${payload}\n`, "utf-8"))
    .catch((err) => {
      console.error(`Failed to persist run event for ${runId}:`, err);
    })
    .then(() => {
      if (writeQueues.get(runId) === next) writeQueues.delete(runId);
    });
  writeQueues.set(runId, next);
}

function loadEventLogFromDisk(runId: string): RunEvent[] {
  const filePath = logFilePath(runId);
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim());
  const events: RunEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as RunEvent);
    } catch {}
  }
  return events;
}

export function subscribe(
  runId: string,
  ws: { send: (data: string) => void },
): void {
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

export function unsubscribe(
  runId: string,
  ws: { send: (data: string) => void },
): void {
  const set = subscribers.get(runId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subscribers.delete(runId);
}

export function emit(runId: string, event: RunEvent): void {
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

export function requestApproval(
  runId: string,
  toolUseID: string,
): Promise<ApprovalDecision> {
  return new Promise((resolve) => {
    const key = `${runId}:${toolUseID}`;
    const timeout = setTimeout(() => {
      pendingApprovals.delete(key);
      resolve({
        approved: false,
        message: "Auto-denied: no response within 5 minutes.",
      });
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

export function requestQuestionAnswer(
  runId: string,
  toolUseID: string,
): Promise<QuestionDecision> {
  return new Promise((resolve) => {
    const key = `${runId}:${toolUseID}`;
    const timeout = setTimeout(() => {
      pendingQuestions.delete(key);
      resolve({
        answered: false,
        message: "Auto-skipped: no response within 5 minutes.",
      });
    }, APPROVAL_TIMEOUT_MS);
    pendingQuestions.set(key, { resolve, timeout });
  });
}

export function resolveQuestionAnswer(
  runId: string,
  toolUseID: string,
  answers: Record<string, string | string[]>,
): boolean {
  const key = `${runId}:${toolUseID}`;
  const pending = pendingQuestions.get(key);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  pendingQuestions.delete(key);
  pending.resolve({ answered: true, answers });
  return true;
}

export function resolveQuestionSkip(
  runId: string,
  toolUseID: string,
  message?: string,
): boolean {
  const key = `${runId}:${toolUseID}`;
  const pending = pendingQuestions.get(key);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  pendingQuestions.delete(key);
  pending.resolve({ answered: false, message });
  return true;
}

export function getPendingApprovalCount(runId: string): number {
  const prefix = `${runId}:`;
  let count = 0;
  for (const key of pendingApprovals.keys()) {
    if (key.startsWith(prefix)) count += 1;
  }
  for (const key of pendingQuestions.keys()) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
}

export function cancelPendingApprovalsForRun(
  runId: string,
  message: string,
): void {
  const prefix = `${runId}:`;
  for (const [key, pending] of pendingApprovals.entries()) {
    if (!key.startsWith(prefix)) continue;
    clearTimeout(pending.timeout);
    pendingApprovals.delete(key);
    pending.resolve({ approved: false, message });
  }
  for (const [key, pending] of pendingQuestions.entries()) {
    if (!key.startsWith(prefix)) continue;
    clearTimeout(pending.timeout);
    pendingQuestions.delete(key);
    pending.resolve({ answered: false, message });
  }
}
