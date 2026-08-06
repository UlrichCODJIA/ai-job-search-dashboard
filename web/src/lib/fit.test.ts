import { describe, expect, test } from "bun:test";
import {
  isLocationExcluded,
  matchesFitFilter,
  rankSortPriority,
  resolveDisplayBucket,
  resolveFitBucket,
} from "./fit";
import type { ScrapedJob } from "../api/types";

function job(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    key: "k",
    title: "Software Engineer",
    company: "Acme",
    url: "https://example.com",
    first_seen: "2026-01-01",
    fit: "medium",
    status: "new",
    ...overrides,
  };
}

describe("resolveFitBucket", () => {
  test("maps ranked verdicts to buckets", () => {
    expect(resolveFitBucket(job({ rank_verdict: "Strong Fit" }))).toBe("high");
    expect(resolveFitBucket(job({ rank_verdict: "Good Fit" }))).toBe("high");
    expect(resolveFitBucket(job({ rank_verdict: "Moderate Fit" }))).toBe("medium");
    expect(resolveFitBucket(job({ rank_verdict: "Weak Fit" }))).toBe("low");
    expect(resolveFitBucket(job({ rank_verdict: "Poor Fit" }))).toBe("low");
  });

  test("falls back to the scraper's quick-fit guess when unranked", () => {
    expect(resolveFitBucket(job({ fit: "high" }))).toBe("high");
    expect(resolveFitBucket(job({ fit: "low" }))).toBe("low");
    expect(resolveFitBucket(job({ fit: "medium" }))).toBe("medium");
  });

  test("is case-insensitive on the verdict string", () => {
    expect(resolveFitBucket(job({ rank_verdict: "strong fit" }))).toBe("high");
  });
});

describe("isLocationExcluded", () => {
  test("true only when rank_location is exactly FAIL", () => {
    expect(isLocationExcluded(job({ rank_location: "FAIL" }))).toBe(true);
    expect(isLocationExcluded(job({ rank_location: "FLAG" }))).toBe(false);
    expect(isLocationExcluded(job({ rank_location: "PASS" }))).toBe(false);
    expect(isLocationExcluded(job())).toBe(false);
  });
});

describe("resolveDisplayBucket", () => {
  test("a high-scoring job that fails location displays as excluded, not high", () => {
    const vetoed = job({ rank_verdict: "Strong Fit", rank_score: 91, rank_location: "FAIL" });
    expect(resolveDisplayBucket(vetoed)).toBe("excluded");
  });

  test("a flagged (not failed) location does not override the real bucket", () => {
    const flagged = job({ rank_verdict: "Strong Fit", rank_location: "FLAG" });
    expect(resolveDisplayBucket(flagged)).toBe("high");
  });

  test("passes through resolveFitBucket when there is no location veto", () => {
    expect(resolveDisplayBucket(job({ rank_verdict: "Moderate Fit" }))).toBe("medium");
  });
});

describe("matchesFitFilter", () => {
  test("the 'all' filter hides an excluded job", () => {
    const excluded = job({ rank_location: "FAIL" });
    expect(matchesFitFilter(excluded, "all")).toBe(false);
  });

  test("the 'all' filter still shows high/medium/low jobs", () => {
    expect(matchesFitFilter(job({ rank_verdict: "Strong Fit" }), "all")).toBe(true);
    expect(matchesFitFilter(job({ rank_verdict: "Moderate Fit" }), "all")).toBe(true);
    expect(matchesFitFilter(job({ rank_verdict: "Poor Fit" }), "all")).toBe(true);
  });

  test("explicitly selecting 'excluded' reveals excluded jobs", () => {
    const excluded = job({ rank_location: "FAIL" });
    expect(matchesFitFilter(excluded, "excluded")).toBe(true);
  });

  test("explicitly selecting 'excluded' hides non-excluded jobs", () => {
    expect(matchesFitFilter(job({ rank_verdict: "Strong Fit" }), "excluded")).toBe(false);
  });

  test("selecting a specific bucket still excludes location-failed jobs even at a matching score", () => {
    const excludedButHighScoring = job({ rank_verdict: "Strong Fit", rank_location: "FAIL" });
    expect(matchesFitFilter(excludedButHighScoring, "high")).toBe(false);
  });

  test("a flagged (not failed) location is unaffected by any filter", () => {
    const flagged = job({ rank_verdict: "Strong Fit", rank_location: "FLAG" });
    expect(matchesFitFilter(flagged, "all")).toBe(true);
    expect(matchesFitFilter(flagged, "high")).toBe(true);
  });
});

describe("rankSortPriority", () => {
  test("excluded jobs always sort last, even with a high score", () => {
    const excluded = job({ rank_score: 95, rank_location: "FAIL" });
    const weakButInPlay = job({ rank_score: 10 });
    expect(rankSortPriority(excluded)).toBeLessThan(rankSortPriority(weakButInPlay));
  });

  test("a real rank_score always outranks an unranked quick-fit guess", () => {
    const rankedLow = job({ rank_score: 5 });
    const unrankedHighGuess = job({ status: "new", fit: "high" });
    expect(rankSortPriority(rankedLow)).toBeGreaterThan(rankSortPriority(unrankedHighGuess));
  });

  test("among ranked jobs, higher rank_score sorts first", () => {
    const a = job({ rank_score: 78 });
    const b = job({ rank_score: 42 });
    expect(rankSortPriority(a)).toBeGreaterThan(rankSortPriority(b));
  });

  test("among unranked jobs, the quick-fit bucket orders them", () => {
    const high = job({ status: "new", fit: "high" });
    const low = job({ status: "new", fit: "low" });
    expect(rankSortPriority(high)).toBeGreaterThan(rankSortPriority(low));
  });
});
