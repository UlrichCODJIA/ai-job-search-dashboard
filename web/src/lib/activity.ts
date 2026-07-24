export interface ActivityDay {
  date: string;
  count: number;
}

/** Buckets first_seen dates into a trailing daily series (oldest -> newest),
 * padded with zero-count days so the grid always has a full, even shape. */
export function buildActivityDays(dates: string[], days = 365): ActivityDay[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const today = new Date();
  const result: ActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    result.push({ date: iso, count: counts.get(iso) ?? 0 });
  }
  return result;
}
