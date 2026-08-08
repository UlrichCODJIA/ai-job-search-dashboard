import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths } from "./helpers/mockPaths.js";

const { getSearchQueries, updateSearchQueries } = await import("../src/lib/searchQueries.js");

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "search-queries-test-"));
  mockPaths.searchQueries = path.join(testDir, "search-queries.md");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("getSearchQueries", () => {
  test("returns an empty string when the file doesn't exist yet", async () => {
    expect(await getSearchQueries()).toBe("");
  });

  test("returns the file's content when it exists", async () => {
    writeFileSync(mockPaths.searchQueries, "## Priority 1\nsite:linkedin.com/jobs \"engineer\"\n", "utf-8");
    expect(await getSearchQueries()).toBe("## Priority 1\nsite:linkedin.com/jobs \"engineer\"\n");
  });
});

describe("updateSearchQueries", () => {
  test("writes the content and round-trips through getSearchQueries", async () => {
    const written = await updateSearchQueries("## New priority\nsite:example.com\n");
    expect(written).toBe("## New priority\nsite:example.com\n");
    expect(await getSearchQueries()).toBe("## New priority\nsite:example.com\n");
  });

  test("appends a trailing newline when the given content is missing one", async () => {
    const written = await updateSearchQueries("no trailing newline");
    expect(written).toBe("no trailing newline\n");
  });

  test("matches the existing file's CRLF line endings when rewriting", async () => {
    writeFileSync(mockPaths.searchQueries, "line one\r\nline two\r\n", "utf-8");
    const written = await updateSearchQueries("line one\nline three\n");
    expect(written).toBe("line one\r\nline three\r\n");
  });
});
