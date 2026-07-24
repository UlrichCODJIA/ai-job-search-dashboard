import type { ScrapedJob, TrackerRow } from "../api/types";

export interface FunnelStageCount {
  label: string;
  value: number;
}

const INTERVIEW_OR_BEYOND = new Set([
  "interview",
  "interview_only",
  "offer",
  "offer_declined",
  "hired",
]);
const OFFER_OR_BEYOND = new Set(["offer", "offer_declined", "hired"]);
const STRONG_FIT_VERDICTS = new Set(["strong fit", "good fit"]);

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/** Derived from the raw status column (not the 5-bucket grouping), so a resolved
 * "interview_only" row still counts as having reached an interview -- the bucket
 * mapping alone would fold it into Rejected/Closed and lose that signal. */
export function computeFunnel(rows: TrackerRow[]): FunnelStageCount[] {
  return [
    { label: "Applied", value: rows.length },
    { label: "Interview", value: rows.filter((r) => INTERVIEW_OR_BEYOND.has(norm(r.status))).length },
    { label: "Offer", value: rows.filter((r) => OFFER_OR_BEYOND.has(norm(r.status))).length },
    { label: "Hired", value: rows.filter((r) => norm(r.status) === "hired").length },
  ];
}

export function daysSince(dateStr: string): number | null {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}

/** High-fit or Strong/Good-Fit-ranked jobs not yet reflected in the tracker (by company). */
export function promisingUnappliedJobs(jobs: ScrapedJob[], trackerRows: TrackerRow[]): ScrapedJob[] {
  const appliedCompanies = new Set(trackerRows.map((r) => norm(r.company)));
  return jobs.filter((job) => {
    if (job.status === "expired" || job.status === "skipped") return false;
    if (appliedCompanies.has(norm(job.company))) return false;
    const highFit = job.fit === "high";
    const strongVerdict = job.rank_verdict ? STRONG_FIT_VERDICTS.has(norm(job.rank_verdict)) : false;
    return highFit || strongVerdict;
  });
}

/** Active-bucket rows whose applied date is old enough to warrant a follow-up or /outcome. */
export function staleActiveRows(rows: TrackerRow[], thresholdDays = 14): TrackerRow[] {
  return rows.filter((r) => r.bucket === "Active" && (daysSince(r.date) ?? 0) >= thresholdDays);
}
