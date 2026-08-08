import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths } from "./helpers/mockPaths.js";

let testDir: string;

const { getCvTemplate, updateCvTemplate } = await import("../src/lib/cvTemplate.js");

describe("cvTemplate", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "cv-template-test-"));
    mkdirSync(path.join(testDir, "cv"), { recursive: true });
    mockPaths.cvMainExample = path.join(testDir, "cv", "main_example.tex");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("getCvTemplate returns an empty string when the file doesn't exist yet", async () => {
    expect(await getCvTemplate()).toBe("");
  });

  test("getCvTemplate returns the file's real content", async () => {
    writeFileSync(mockPaths.cvMainExample, "\\name{Jane}{Doe}\n", "utf-8");
    expect(await getCvTemplate()).toBe("\\name{Jane}{Doe}\n");
  });

  test("updateCvTemplate writes the content and returns it", async () => {
    const result = await updateCvTemplate("\\name{Jane}{Doe}\n");
    expect(result).toBe("\\name{Jane}{Doe}\n");
    expect(readFileSync(mockPaths.cvMainExample, "utf-8")).toBe("\\name{Jane}{Doe}\n");
  });

  test("updateCvTemplate adds a trailing newline if missing", async () => {
    const result = await updateCvTemplate("\\name{Jane}{Doe}");
    expect(result).toBe("\\name{Jane}{Doe}\n");
  });

  test("updateCvTemplate matches the existing file's line-ending convention", async () => {
    writeFileSync(mockPaths.cvMainExample, "old content\r\n", "utf-8");
    const result = await updateCvTemplate("new content\n");
    expect(result).toBe("new content\r\n");
  });
});
