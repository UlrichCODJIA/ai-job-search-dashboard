import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths } from "./helpers/mockPaths.js";

const { listReports, resolveReportPath } = await import("../src/lib/reports.js");

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "reports-test-"));
  mockPaths.reportsDir = path.join(testDir, "reports");
  mkdirSync(mockPaths.reportsDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("listReports", () => {
  test("returns [] when the reports directory has nothing (or doesn't exist)", async () => {
    rmSync(mockPaths.reportsDir, { recursive: true, force: true });
    expect(await listReports()).toEqual([]);
  });

  test("lists only .html files, newest modified first", async () => {
    writeFileSync(path.join(mockPaths.reportsDir, "older.html"), "<html></html>");
    writeFileSync(path.join(mockPaths.reportsDir, "newer.html"), "<html></html>");
    writeFileSync(path.join(mockPaths.reportsDir, "notes.txt"), "not a report");
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();
    utimesSync(path.join(mockPaths.reportsDir, "older.html"), older, older);
    utimesSync(path.join(mockPaths.reportsDir, "newer.html"), newer, newer);

    const reports = await listReports();
    expect(reports.map((r) => r.filename)).toEqual(["newer.html", "older.html"]);
  });
});

describe("resolveReportPath", () => {
  test("resolves to the real path for an existing report", async () => {
    writeFileSync(path.join(mockPaths.reportsDir, "dashboard.html"), "<html></html>");
    expect(resolveReportPath("dashboard.html")).toBe(path.join(mockPaths.reportsDir, "dashboard.html"));
  });

  test("returns null for a non-.html filename, even if such a file exists", () => {
    writeFileSync(path.join(mockPaths.reportsDir, "dashboard.txt"), "not html");
    expect(resolveReportPath("dashboard.txt")).toBeNull();
  });

  test("returns null for an .html filename that doesn't exist on disk", () => {
    expect(resolveReportPath("missing.html")).toBeNull();
  });

  test("resolves a path-traversal filename to its safe basename, not outside the reports dir", () => {
    writeFileSync(path.join(mockPaths.reportsDir, "escape.html"), "<html></html>");
    expect(resolveReportPath("../../escape.html")).toBe(path.join(mockPaths.reportsDir, "escape.html"));
  });
});
