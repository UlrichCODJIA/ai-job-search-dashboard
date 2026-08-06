import { describe, expect, test } from "bun:test";
import {
  daysAgoLabel,
  isStaleActiveRow,
  isStaleDraftRow,
  isStaleInterviewRow,
  isStaleNewJob,
  promisingUnappliedJobs,
  staleActiveRows,
  staleDraftRows,
  staleInterviewRows,
  trackerRowForCompany,
} from "./pipeline";
import type { ScrapedJob, TrackerRow } from "../api/types";

function job(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    key: overrides.company ?? "k",
    title: "Software Engineer",
    company: "Acme",
    url: "https://example.com",
    first_seen: "2026-01-01",
    fit: "medium",
    status: "new",
    ...overrides,
  };
}

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

describe("promisingUnappliedJobs", () => {
  test("a real 91-scoring job that fails location is not promising (the Crate App case)", () => {
    const vetoed = job({
      company: "Crate App",
      rank_verdict: "Good Fit",
      rank_score: 62.25,
      rank_location: "FAIL",
      status: "ranked",
    });
    expect(promisingUnappliedJobs([vetoed], [])).toEqual([]);
  });

  test("a stale high scraper guess does not override a genuinely poor real verdict (the VELAIO case)", () => {
    const staleGuess = job({
      company: "VELAIO",
      fit: "high",
      rank_verdict: "Poor Fit",
      rank_score: 29.25,
      rank_location: "FAIL",
      status: "ranked",
    });
    expect(promisingUnappliedJobs([staleGuess], [])).toEqual([]);
  });

  test("a stale high scraper guess does not override a moderate real verdict either", () => {
    const moderate = job({
      company: "Simera",
      fit: "high",
      rank_verdict: "Moderate Fit",
      rank_score: 45,
      status: "ranked",
    });
    expect(promisingUnappliedJobs([moderate], [])).toEqual([]);
  });

  test("a genuinely strong, non-excluded ranked job is still promising", () => {
    const strong = job({
      company: "name (futuresearch)",
      fit: "high",
      rank_verdict: "Strong Fit",
      rank_score: 78,
      status: "ranked",
    });
    expect(promisingUnappliedJobs([strong], [])).toEqual([strong]);
  });

  test("an unranked job with a high scraper guess is still promising (no real verdict to prefer yet)", () => {
    const unranked = job({ company: "New Co", fit: "high", status: "new" });
    expect(promisingUnappliedJobs([unranked], [])).toEqual([unranked]);
  });

  test("a location FLAG (not FAIL) does not exclude an otherwise-strong job", () => {
    const flagged = job({
      company: "Travel Co",
      rank_verdict: "Strong Fit",
      rank_score: 80,
      rank_location: "FLAG",
      status: "ranked",
    });
    expect(promisingUnappliedJobs([flagged], [])).toEqual([flagged]);
  });

  test("expired and skipped jobs are never promising regardless of fit", () => {
    const expired = job({ company: "Zania", fit: "high", status: "expired" });
    const skipped = job({ company: "Skip Co", fit: "high", status: "skipped" });
    expect(promisingUnappliedJobs([expired, skipped], [])).toEqual([]);
  });

  test("a job already in the tracker (applied) is excluded even if it would otherwise qualify", () => {
    const applied = job({
      company: "Acme",
      rank_verdict: "Strong Fit",
      rank_score: 90,
      status: "ranked",
    });
    expect(promisingUnappliedJobs([applied], [trackerRow({ company: "Acme" })])).toEqual([]);
  });

  test("tracker company matching is case-insensitive", () => {
    const applied = job({
      company: "acme",
      rank_verdict: "Strong Fit",
      rank_score: 90,
      status: "ranked",
    });
    expect(promisingUnappliedJobs([applied], [trackerRow({ company: "ACME" })])).toEqual([]);
  });
});

describe("isStaleActiveRow / staleActiveRows", () => {
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  test("an Active row past the threshold is stale", () => {
    const row = trackerRow({ bucket: "Active", date: oldDate });
    expect(isStaleActiveRow(row)).toBe(true);
  });

  test("an Active row within the threshold is not stale", () => {
    const row = trackerRow({ bucket: "Active", date: recentDate });
    expect(isStaleActiveRow(row)).toBe(false);
  });

  test("a non-Active row is never stale, regardless of age", () => {
    const row = trackerRow({ bucket: "Interview", date: oldDate });
    expect(isStaleActiveRow(row)).toBe(false);
  });

  test("a custom threshold is respected", () => {
    const row = trackerRow({ bucket: "Active", date: recentDate });
    expect(isStaleActiveRow(row, 1)).toBe(true);
  });

  test("staleActiveRows filters using the same rule as isStaleActiveRow (no drift between the two)", () => {
    const stale = trackerRow({ id: "a", bucket: "Active", date: oldDate });
    const fresh = trackerRow({ id: "b", bucket: "Active", date: recentDate });
    const notActive = trackerRow({ id: "c", bucket: "Interview", date: oldDate });
    expect(staleActiveRows([stale, fresh, notActive])).toEqual([stale]);
  });
});

describe("isStaleDraftRow / staleDraftRows", () => {
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  test("a Drafted row past the threshold is stale", () => {
    const row = trackerRow({ bucket: "Drafted", date: oldDate });
    expect(isStaleDraftRow(row)).toBe(true);
  });

  test("a Drafted row within the threshold is not stale", () => {
    const row = trackerRow({ bucket: "Drafted", date: recentDate });
    expect(isStaleDraftRow(row)).toBe(false);
  });

  test("an Active row is never flagged by isStaleDraftRow, even if old -- that's isStaleActiveRow's signal", () => {
    const row = trackerRow({ bucket: "Active", date: oldDate });
    expect(isStaleDraftRow(row)).toBe(false);
  });

  test("a custom threshold is respected", () => {
    const row = trackerRow({ bucket: "Drafted", date: recentDate });
    expect(isStaleDraftRow(row, 1)).toBe(true);
  });

  test("staleDraftRows filters using the same rule as isStaleDraftRow (no drift between the two)", () => {
    const stale = trackerRow({ id: "a", bucket: "Drafted", date: oldDate });
    const fresh = trackerRow({ id: "b", bucket: "Drafted", date: recentDate });
    const notDrafted = trackerRow({ id: "c", bucket: "Active", date: oldDate });
    expect(staleDraftRows([stale, fresh, notDrafted])).toEqual([stale]);
  });
});

describe("isStaleInterviewRow / staleInterviewRows", () => {
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  test("an Interview row whose next_interview_date has long passed is stale", () => {
    const row = trackerRow({ bucket: "Interview", date: oldDate, next_interview_date: oldDate });
    expect(isStaleInterviewRow(row)).toBe(true);
  });

  test("an Interview row whose next_interview_date is upcoming is never stale", () => {
    const row = trackerRow({ bucket: "Interview", date: oldDate, next_interview_date: futureDate });
    expect(isStaleInterviewRow(row)).toBe(false);
  });

  test("an Interview row with no next_interview_date falls back to the applied date", () => {
    const row = trackerRow({ bucket: "Interview", date: oldDate, next_interview_date: undefined });
    expect(isStaleInterviewRow(row)).toBe(true);
  });

  test("an Interview row with no next_interview_date and a recent applied date is not stale", () => {
    const row = trackerRow({ bucket: "Interview", date: recentDate, next_interview_date: undefined });
    expect(isStaleInterviewRow(row)).toBe(false);
  });

  test("a non-Interview row is never flagged, even with an old next_interview_date", () => {
    const row = trackerRow({ bucket: "Active", date: oldDate, next_interview_date: oldDate });
    expect(isStaleInterviewRow(row)).toBe(false);
  });

  test("a custom threshold is respected", () => {
    const row = trackerRow({ bucket: "Interview", date: oldDate, next_interview_date: recentDate });
    expect(isStaleInterviewRow(row, 1)).toBe(true);
  });

  test("staleInterviewRows filters using the same rule as isStaleInterviewRow (no drift between the two)", () => {
    const stale = trackerRow({
      id: "a",
      bucket: "Interview",
      date: oldDate,
      next_interview_date: oldDate,
    });
    const fresh = trackerRow({
      id: "b",
      bucket: "Interview",
      date: oldDate,
      next_interview_date: futureDate,
    });
    const notInterview = trackerRow({ id: "c", bucket: "Active", date: oldDate });
    expect(staleInterviewRows([stale, fresh, notInterview])).toEqual([stale]);
  });
});

describe("trackerRowForCompany", () => {
  test("finds a row matching the company name exactly", () => {
    const row = trackerRow({ company: "Acme" });
    expect(trackerRowForCompany("Acme", [row])).toBe(row);
  });

  test("matching is case-insensitive", () => {
    const row = trackerRow({ company: "ACME" });
    expect(trackerRowForCompany("acme", [row])).toBe(row);
  });

  test("returns null when no row matches", () => {
    const row = trackerRow({ company: "Acme" });
    expect(trackerRowForCompany("Other Co", [row])).toBeNull();
  });

  test("returns null for an empty company name rather than matching everything", () => {
    const row = trackerRow({ company: "Acme" });
    expect(trackerRowForCompany("", [row])).toBeNull();
  });
});

describe("isStaleNewJob", () => {
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  test("a new job past the threshold is stale", () => {
    expect(isStaleNewJob(job({ status: "new", first_seen: oldDate }))).toBe(true);
  });

  test("a new job within the threshold is not stale", () => {
    expect(isStaleNewJob(job({ status: "new", first_seen: recentDate }))).toBe(false);
  });

  test("a ranked job is never flagged, regardless of age -- it's already been acted on", () => {
    expect(isStaleNewJob(job({ status: "ranked", first_seen: oldDate }))).toBe(false);
  });

  test("a custom threshold is respected", () => {
    expect(isStaleNewJob(job({ status: "new", first_seen: recentDate }), 1)).toBe(true);
  });
});

describe("daysAgoLabel", () => {
  test("null renders as an em dash placeholder", () => {
    expect(daysAgoLabel(null)).toBe("—");
  });

  test("0 or negative renders as 'today'", () => {
    expect(daysAgoLabel(0)).toBe("today");
    expect(daysAgoLabel(-1)).toBe("today");
  });

  test("1 is singular", () => {
    expect(daysAgoLabel(1)).toBe("1 day ago");
  });

  test("more than 1 is plural", () => {
    expect(daysAgoLabel(5)).toBe("5 days ago");
  });
});
