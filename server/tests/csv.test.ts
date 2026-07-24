import { describe, expect, test } from "bun:test";
import { parseCsvRows, rowsToRecords, stringifyCsv } from "../src/lib/csv.js";

describe("csv", () => {
  test("parses simple rows", () => {
    const rows = parseCsvRows("a,b,c\n1,2,3\n");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  test("handles quoted fields with embedded commas and escaped quotes", () => {
    const rows = parseCsvRows('date,notes\n2026-01-01,"Said ""hi"", then left, quickly"\n');
    expect(rows).toEqual([
      ["date", "notes"],
      ["2026-01-01", 'Said "hi", then left, quickly'],
    ]);
  });

  test("skips blank trailing rows", () => {
    const { header, rows } = rowsToRecords(parseCsvRows("company,status\nAcme,applied\n\n"));
    expect(header).toEqual(["company", "status"]);
    expect(rows).toEqual([{ company: "Acme", status: "applied" }]);
  });

  test("round-trips a value containing a comma", () => {
    const csv = stringifyCsv(["company", "notes"], [{ company: "Acme", notes: "a, b, c" }]);
    const { rows } = rowsToRecords(parseCsvRows(csv));
    expect(rows[0]?.notes).toBe("a, b, c");
  });
});
