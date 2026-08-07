import { describe, expect, test } from "bun:test";
import type { TrackerRow } from "../api/types";
import { buildAttentionItems } from "./notifications";

function trackerRow(overrides: Partial<TrackerRow> = {}): TrackerRow {
  return {
    id: "t1",
    bucket: "Active",
    date: "2026-01-01",
    company: "Acme",
    sector: "",
    role: "",
    role_type: "",
    channel: "",
    status: "applied",
    contact_person: "",
    fit_rating: "",
    notes: "",
    cv_file: "",
    cover_letter_file: "",
    cv_file_pdf: "",
    cover_letter_file_pdf: "",
    source: "",
    ...overrides,
  };
}

const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const urgentInterviewDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const farInterviewDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

describe("buildAttentionItems", () => {
  test("returns nothing for a fresh, unremarkable tracker", () => {
    const row = trackerRow({ bucket: "Active", date: recentDate });
    expect(buildAttentionItems([row])).toEqual([]);
  });

  test("flags a row with an interview within the urgent window", () => {
    const row = trackerRow({
      id: "t-interview",
      bucket: "Interview",
      date: recentDate,
      next_interview_date: urgentInterviewDate,
    });
    const items = buildAttentionItems([row]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(`interview:t-interview:${urgentInterviewDate}`);
    expect(items[0].title).toContain("Acme");
  });

  test("does not flag an interview far in the future", () => {
    const row = trackerRow({
      bucket: "Interview",
      date: recentDate,
      next_interview_date: farInterviewDate,
    });
    expect(buildAttentionItems([row])).toEqual([]);
  });

  test("flags a stale Active row", () => {
    const row = trackerRow({ id: "t-stale", bucket: "Active", date: oldDate });
    const items = buildAttentionItems([row]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(`stale:t-stale:Active:${oldDate}`);
  });

  test("flags a stale Drafted row", () => {
    const row = trackerRow({ id: "t-draft", bucket: "Drafted", date: oldDate });
    const items = buildAttentionItems([row]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(`stale:t-draft:Drafted:${oldDate}`);
  });

  test("a row can surface both an urgent-interview item and a stale item at once", () => {
    const row = trackerRow({
      id: "t-both",
      bucket: "Active",
      date: oldDate,
      next_interview_date: urgentInterviewDate,
    });
    const items = buildAttentionItems([row]);
    expect(items).toHaveLength(2);
    const keys = items.map((i) => i.key);
    expect(keys).toContain(`interview:t-both:${urgentInterviewDate}`);
    expect(keys).toContain(`stale:t-both:Active:${oldDate}`);
  });

  test("an Interview-bucket row with an upcoming interview date is not also flagged stale", () => {
    const row = trackerRow({
      bucket: "Interview",
      date: oldDate,
      next_interview_date: urgentInterviewDate,
    });
    const items = buildAttentionItems([row]);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(`interview:t1:${urgentInterviewDate}`);
  });

  test("distinct rows produce distinct keys, even with identical status/date", () => {
    const rowA = trackerRow({ id: "a", bucket: "Active", date: oldDate });
    const rowB = trackerRow({ id: "b", bucket: "Active", date: oldDate });
    const items = buildAttentionItems([rowA, rowB]);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
  });
});
