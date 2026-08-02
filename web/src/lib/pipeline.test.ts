import { describe, expect, test } from "bun:test";
import { promisingUnappliedJobs } from "./pipeline";
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
