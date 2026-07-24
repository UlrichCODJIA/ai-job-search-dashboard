import { describe, expect, test } from "bun:test";
import { assertValidCompanyEntry, findCompanyIndex, type SalaryCompanyEntry } from "../src/lib/salary.js";

const COMPANIES: SalaryCompanyEntry[] = [
  { company: "Acme Corp", city: "Remote" },
  { company: "Beta LLC", city: "Kigali" },
];

describe("findCompanyIndex", () => {
  test("finds an exact match", () => {
    expect(findCompanyIndex(COMPANIES, "Beta LLC")).toBe(1);
  });

  test("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(findCompanyIndex(COMPANIES, "  acme corp  ")).toBe(0);
  });

  test("returns -1 when no company matches", () => {
    expect(findCompanyIndex(COMPANIES, "Nope Inc")).toBe(-1);
  });
});

describe("assertValidCompanyEntry", () => {
  test("accepts a minimal valid entry", () => {
    expect(() => assertValidCompanyEntry({ company: "Acme Corp" })).not.toThrow();
  });

  test("accepts numeric category count/index", () => {
    expect(() =>
      assertValidCompanyEntry({
        company: "Acme Corp",
        categories: { engineering: { count: 10, index: 7500 } },
      }),
    ).not.toThrow();
  });

  test("rejects an empty company name", () => {
    expect(() => assertValidCompanyEntry({ company: "   " })).toThrow(/company name/i);
  });

  test("rejects a non-numeric category count", () => {
    expect(() =>
      assertValidCompanyEntry({
        company: "Acme Corp",
        categories: { engineering: { count: "ten" as unknown as number } },
      }),
    ).toThrow(/count must be a number/i);
  });

  test("rejects a non-numeric category index", () => {
    expect(() =>
      assertValidCompanyEntry({
        company: "Acme Corp",
        categories: { engineering: { index: "high" as unknown as number } },
      }),
    ).toThrow(/index must be a number/i);
  });
});
