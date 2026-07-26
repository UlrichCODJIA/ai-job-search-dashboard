import type { ScrapedJob } from "../api/types";

export function resolveFitBucket(job: ScrapedJob): "high" | "medium" | "low" {
  const verdict = job.rank_verdict?.toLowerCase();
  if (verdict === "strong fit" || verdict === "good fit") return "high";
  if (verdict === "moderate fit") return "medium";
  if (verdict === "weak fit" || verdict === "poor fit") return "low";
  return job.fit === "high" || job.fit === "low" ? job.fit : "medium";
}
