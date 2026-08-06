import type { ScrapedJob } from "../api/types";

export type FitBucket = "high" | "medium" | "low";
export type DisplayBucket = FitBucket | "excluded";

export function resolveFitBucket(job: ScrapedJob): FitBucket {
  const verdict = job.rank_verdict?.toLowerCase();
  if (verdict === "strong fit" || verdict === "good fit") return "high";
  if (verdict === "moderate fit") return "medium";
  if (verdict === "weak fit" || verdict === "poor fit") return "low";
  return job.fit === "high" || job.fit === "low" ? job.fit : "medium";
}

export function isLocationExcluded(job: ScrapedJob): boolean {
  return job.rank_location === "FAIL";
}

export function resolveDisplayBucket(job: ScrapedJob): DisplayBucket {
  return isLocationExcluded(job) ? "excluded" : resolveFitBucket(job);
}

export function matchesFitFilter(job: ScrapedJob, fitFilter: string): boolean {
  const bucket = resolveDisplayBucket(job);
  if (fitFilter === "all") return bucket !== "excluded";
  return bucket === fitFilter;
}

const QUICK_FIT_PRIORITY: Record<FitBucket, number> = { high: 3, medium: 2, low: 1 };

export function rankSortPriority(job: ScrapedJob): number {
  if (isLocationExcluded(job)) return -1;
  if (typeof job.rank_score === "number") return 1000 + job.rank_score;
  return QUICK_FIT_PRIORITY[resolveFitBucket(job)];
}
