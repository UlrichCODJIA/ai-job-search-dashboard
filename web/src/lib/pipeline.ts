import type { ScrapedJob, TrackerRow } from "../api/types";
import { resolveDisplayBucket } from "./fit";

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

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export function computeFunnel(rows: TrackerRow[]): FunnelStageCount[] {
  return [
    { label: "Applied", value: rows.length },
    {
      label: "Interview",
      value: rows.filter((r) => INTERVIEW_OR_BEYOND.has(norm(r.status))).length,
    },
    {
      label: "Offer",
      value: rows.filter((r) => OFFER_OR_BEYOND.has(norm(r.status))).length,
    },
    {
      label: "Hired",
      value: rows.filter((r) => norm(r.status) === "hired").length,
    },
  ];
}

export function daysSince(dateStr: string): number | null {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}

export function promisingUnappliedJobs(
  jobs: ScrapedJob[],
  trackerRows: TrackerRow[],
): ScrapedJob[] {
  const appliedCompanies = new Set(trackerRows.map((r) => norm(r.company)));
  return jobs.filter((job) => {
    if (job.status === "expired" || job.status === "skipped") return false;
    if (appliedCompanies.has(norm(job.company))) return false;
    return resolveDisplayBucket(job) === "high";
  });
}

export const STALE_ACTIVE_DAYS_THRESHOLD = 14;

export function isStaleActiveRow(
  row: TrackerRow,
  thresholdDays = STALE_ACTIVE_DAYS_THRESHOLD,
): boolean {
  return row.bucket === "Active" && (daysSince(row.date) ?? 0) >= thresholdDays;
}

export function staleActiveRows(
  rows: TrackerRow[],
  thresholdDays = STALE_ACTIVE_DAYS_THRESHOLD,
): TrackerRow[] {
  return rows.filter((r) => isStaleActiveRow(r, thresholdDays));
}

export function daysAgoLabel(days: number | null): string {
  if (days === null) return "—";
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export const GROUP_BAR_PALETTE = [
  "#0891b2",
  "#8b5cf6",
  "#84cc16",
  "#f59e0b",
  "#ec4899",
];

export function groupCount(rows: TrackerRow[], key: "sector" | "channel") {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = (row[key] ?? "").trim() || "Unspecified";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .map((entry, i) => ({
      ...entry,
      color: GROUP_BAR_PALETTE[i % GROUP_BAR_PALETTE.length],
    }));
}
