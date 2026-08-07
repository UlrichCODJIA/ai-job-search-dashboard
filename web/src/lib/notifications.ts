import type { TrackerRow } from "../api/types";
import { isUrgentDeadline } from "./deadline";
import { staleActiveRows, staleDraftRows, staleInterviewRows } from "./pipeline";

export interface AttentionItem {
  key: string;
  title: string;
  body: string;
}

export function buildAttentionItems(tracker: TrackerRow[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const row of tracker) {
    if (isUrgentDeadline(row.next_interview_date)) {
      items.push({
        key: `interview:${row.id}:${row.next_interview_date}`,
        title: `Interview coming up - ${row.company}`,
        body: `Interview on ${row.next_interview_date}. Make sure your prep is ready.`,
      });
    }
  }

  for (const row of [
    ...staleActiveRows(tracker),
    ...staleDraftRows(tracker),
    ...staleInterviewRows(tracker),
  ]) {
    items.push({
      key: `stale:${row.id}:${row.bucket}:${row.date}`,
      title: `Follow up - ${row.company}`,
      body: `Still ${row.bucket.toLowerCase()} with no update in a while, worth a follow-up.`,
    });
  }

  return items;
}

const ENABLED_KEY = "mission-control:notifications-enabled:v1";
const NOTIFIED_KEY_PREFIX = "mission-control:notified:v1:";

const listeners = new Set<() => void>();

export function subscribeNotificationsEnabled(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getNotificationsEnabledSnapshot(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "true";
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, String(enabled));
  for (const listener of listeners) listener();
}

function todayStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function shouldNotifyToday(key: string, now: Date = new Date()): boolean {
  return localStorage.getItem(NOTIFIED_KEY_PREFIX + key) !== todayStamp(now);
}

export function markNotified(key: string, now: Date = new Date()): void {
  localStorage.setItem(NOTIFIED_KEY_PREFIX + key, todayStamp(now));
}
