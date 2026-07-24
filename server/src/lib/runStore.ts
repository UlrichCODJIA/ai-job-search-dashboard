import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, withFileLock } from "./fs.js";
import { paths } from "./paths.js";

export type RunStatus = "running" | "completed" | "error" | "stopped";

export interface RunRecord {
  id: string;
  command: string;
  args?: string;
  resumeKey?: string;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  sessionId?: string;
  costUsd?: number;
  error?: string;
}

interface RunStoreFile {
  runs: RunRecord[];
  sessionByKey: Record<string, string>;
}

const STORE_PATH = path.join(paths.runsDir, "runs.json");

async function readStore(): Promise<RunStoreFile> {
  if (!existsSync(STORE_PATH)) return { runs: [], sessionByKey: {} };
  const text = await readFile(STORE_PATH, "utf-8");
  const data = JSON.parse(text) as Partial<RunStoreFile>;
  return { runs: data.runs ?? [], sessionByKey: data.sessionByKey ?? {} };
}

async function writeStore(data: RunStoreFile): Promise<void> {
  return atomicWriteFile(STORE_PATH, JSON.stringify(data, null, 2) + "\n");
}

export async function listRuns(): Promise<RunRecord[]> {
  const { runs } = await readStore();
  return [...runs].sort((a, b) => b.startedAt - a.startedAt);
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const { runs } = await readStore();
  return runs.find((r) => r.id === id) ?? null;
}

export async function createRun(record: RunRecord): Promise<void> {
  await withFileLock(STORE_PATH, async () => {
    const store = await readStore();
    store.runs.push(record);
    await writeStore(store);
  });
}

export async function updateRun(id: string, patch: Partial<RunRecord>): Promise<void> {
  await withFileLock(STORE_PATH, async () => {
    const store = await readStore();
    const index = store.runs.findIndex((r) => r.id === id);
    if (index === -1) return;
    store.runs[index] = { ...store.runs[index], ...patch };
    await writeStore(store);
  });
}

export async function getSessionForKey(key: string): Promise<string | undefined> {
  const { sessionByKey } = await readStore();
  // Object.hasOwn guard: a bare `sessionByKey[key]` for key === "__proto__" reads back
  // Object.prototype (truthy) instead of undefined, since sessionByKey is a plain {}.
  return Object.hasOwn(sessionByKey, key) ? sessionByKey[key] : undefined;
}

export async function setSessionForKey(key: string, sessionId: string): Promise<void> {
  await withFileLock(STORE_PATH, async () => {
    const store = await readStore();
    store.sessionByKey[key] = sessionId;
    await writeStore(store);
  });
}
