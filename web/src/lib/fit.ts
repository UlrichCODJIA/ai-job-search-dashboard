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

// /rank vetoes a job on a hard location deal-breaker (relocation required, etc.)
// independently of its score -- a 91-scoring job that fails location is not a
// real candidate. resolveFitBucket alone can't express that (it only reads
// rank_verdict), so callers that need to distinguish "actually in play" from
// "vetoed regardless of score" should check this first.
export function isLocationExcluded(job: ScrapedJob): boolean {
  return job.rank_location === "FAIL";
}

export function resolveDisplayBucket(job: ScrapedJob): DisplayBucket {
  return isLocationExcluded(job) ? "excluded" : resolveFitBucket(job);
}

// Default sort priority, highest first. A real /rank score (0-100) always
// outranks an unranked scraper quick-fit guess -- /scrape's fit is an eyeballed
// signal, /rank's score is fetched-and-scored triage, and conflating them would
// let a rough guess look more authoritative than it is. Excluded jobs sort last
// regardless of score: they aren't real candidates.
const QUICK_FIT_PRIORITY: Record<FitBucket, number> = { high: 3, medium: 2, low: 1 };

export function rankSortPriority(job: ScrapedJob): number {
  if (isLocationExcluded(job)) return -1;
  if (typeof job.rank_score === "number") return 1000 + job.rank_score;
  return QUICK_FIT_PRIORITY[resolveFitBucket(job)];
}
