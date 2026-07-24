import { describe, expect, test } from "bun:test";
import { bucketForStatus, type StatusBucket } from "../src/lib/tracker.js";

const CASES: [string, StatusBucket][] = [
  ["applied", "Active"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["hired", "Hired"],
  ["rejected", "Rejected/Closed"],
  ["no_response", "Rejected/Closed"],
  ["no response", "Rejected/Closed"],
  ["offer_declined", "Rejected/Closed"],
  ["interview_only", "Rejected/Closed"],
  ["withdrawn", "Rejected/Closed"],
  ["  Interview  ", "Interview"],
  ["something_unknown", "Active"],
];

describe("bucketForStatus", () => {
  test.each(CASES)("%s -> %s", (input, expected) => {
    expect(bucketForStatus(input)).toBe(expected);
  });
});
