// Whole-day difference, ignoring time-of-day, so "today" always reads as 0
// regardless of what time it currently is.
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysUntil(dateStr: string, now: Date = new Date()): number | null {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((startOfDay(parsed) - startOfDay(now)) / MS_PER_DAY);
}

// Matches /rank's own rule: a deadline within 7 days gets a 🔥 marker.
export function isUrgentDeadline(dateStr: string | null | undefined, now?: Date): boolean {
  if (!dateStr) return false;
  const days = daysUntil(dateStr, now);
  return days !== null && days >= 0 && days <= 7;
}

export function isPastDeadline(dateStr: string | null | undefined, now?: Date): boolean {
  if (!dateStr) return false;
  const days = daysUntil(dateStr, now);
  return days !== null && days < 0;
}

export function resolveEffectiveDeadline(job: {
  deadline?: string | null;
  rank_deadline?: string | null;
}): string | null {
  return job.rank_deadline ?? job.deadline ?? null;
}
