import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { atomicWriteFile, withFileLock } from "./fs.js";
import { paths } from "./paths.js";

export interface ScrapedJob {
  key: string;
  title: string;
  company: string;
  url: string;
  first_seen: string;
  fit: "high" | "medium" | "low" | string;
  status: "new" | "skipped" | "evaluated" | "ranked" | "expired" | string;
  rank_score?: number;
  rank_verdict?: string;
  rank_date?: string;
  rank_strengths?: string[];
  rank_gaps?: string[];
  rank_deadline?: string | null;
  rank_location?: "PASS" | "FAIL" | "FLAG" | string;
  [extra: string]: unknown;
}

interface SeenJobsFile {
  seen: Record<string, Omit<ScrapedJob, "key">>;
}

async function readSeenJobsFile(): Promise<SeenJobsFile> {
  if (!existsSync(paths.seenJobs)) return { seen: {} };
  const text = await readFile(paths.seenJobs, "utf-8");
  const data = JSON.parse(text) as Partial<SeenJobsFile>;
  return { seen: data.seen ?? {} };
}

export async function listScrapedJobs(): Promise<ScrapedJob[]> {
  const { seen } = await readSeenJobsFile();
  return Object.entries(seen).map(
    ([key, job]) => ({ key, ...job }) as ScrapedJob,
  );
}

export async function updateScrapedJob(
  key: string,
  patch: Record<string, unknown>,
): Promise<ScrapedJob | null> {
  return withFileLock(paths.seenJobs, async () => {
    const data = await readSeenJobsFile();
    const existing = Object.hasOwn(data.seen, key) ? data.seen[key] : undefined;
    if (!existing) return null;

    data.seen[key] = { ...existing, ...patch };
    await atomicWriteFile(paths.seenJobs, JSON.stringify(data, null, 2) + "\n");
    return { key, ...data.seen[key] } as ScrapedJob;
  });
}
