import type { ScrapedJob } from "../api/types";

// /rank writes a 5-band verdict (rank.md: Strong Fit 75+, Good Fit 60-74,
// Moderate Fit 45-59, Weak Fit 30-44, Poor Fit <30) that's more authoritative
// than the crude high/medium/low `fit` /scrape assigns at collection time --
// but only ~20 of 150 jobs get ranked before /apply, so most postings only
// have `fit`. Resolving to the same 3 buckets everywhere (chart, stat cards,
// filter) keeps them all in agreement instead of the chart quietly using a
// staler signal than the table's own FitPill (which already prefers
// rank_verdict) shows per row.
export function resolveFitBucket(job: ScrapedJob): "high" | "medium" | "low" {
  const verdict = job.rank_verdict?.toLowerCase();
  if (verdict === "strong fit" || verdict === "good fit") return "high";
  if (verdict === "moderate fit") return "medium";
  if (verdict === "weak fit" || verdict === "poor fit") return "low";
  return job.fit === "high" || job.fit === "low" ? job.fit : "medium";
}
