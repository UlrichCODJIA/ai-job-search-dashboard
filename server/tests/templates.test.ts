import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

const { listRegisteredTemplates } = await import("../src/lib/templates.js");

function writeManifest(
  type: "cv" | "cover_letters",
  name: string,
  fields: { engine?: string; pageLimit?: string; fonts?: string } = {},
): void {
  const dir = path.join(testDir, "templates", type, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "TEMPLATE.md"),
    [
      `# Template: ${name}`,
      "",
      `- **Type:** ${type === "cv" ? "CV" : "Cover letter"}`,
      `- **Engine:** ${fields.engine ?? "lualatex"}`,
      `- **Page limit:** ${fields.pageLimit ?? "2 page(s)"}`,
      `- **Fonts:** ${fields.fonts ?? "Lato (system font - must be installed)"}`,
      `- **Class/packages:** standard`,
    ].join("\n"),
    "utf-8",
  );
}

function writeGuidance(filePath: string, activeName: string | null): void {
  const block = activeName
    ? [
        "<!-- BEGIN ACTIVE-TEMPLATE (managed by /add-template - do not edit by hand) -->",
        `> **Active template override: \`${activeName}\`**`,
        "<!-- END ACTIVE-TEMPLATE -->",
        "",
      ].join("\n")
    : "";
  writeFileSync(filePath, `# CV Templates\n\n${block}Stock guidance below.\n`, "utf-8");
}

describe("listRegisteredTemplates", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "templates-test-"));
    mockPaths.templatesDir = path.join(testDir, "templates");
    mockPaths.cvTemplatesGuidance = path.join(testDir, "05-cv-templates.md");
    mockPaths.coverLetterTemplatesGuidance = path.join(testDir, "06-cover-letter-templates.md");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("no templates directory at all returns an empty list, not an error", async () => {
    expect(await listRegisteredTemplates()).toEqual([]);
  });

  test("a registered CV template with no active block is listed but not active", async () => {
    writeManifest("cv", "awesome-cv", { engine: "xelatex", pageLimit: "1 page(s)" });
    const templates = await listRegisteredTemplates();
    expect(templates).toEqual([
      {
        name: "awesome-cv",
        type: "cv",
        engine: "xelatex",
        pageLimit: "1 page(s)",
        fonts: "Lato (system font - must be installed)",
        active: false,
      },
    ]);
  });

  test("the template named in the ACTIVE-TEMPLATE block is marked active", async () => {
    writeManifest("cv", "awesome-cv");
    writeManifest("cv", "classic-serif");
    writeGuidance(mockPaths.cvTemplatesGuidance, "classic-serif");

    const templates = await listRegisteredTemplates();
    expect(templates.find((t) => t.name === "awesome-cv")?.active).toBe(false);
    expect(templates.find((t) => t.name === "classic-serif")?.active).toBe(true);
  });

  test("CV and cover letter templates are both listed, checked against their own guidance file", async () => {
    writeManifest("cv", "awesome-cv");
    writeManifest("cover_letters", "modern-letter");
    writeGuidance(mockPaths.cvTemplatesGuidance, "awesome-cv");
    writeGuidance(mockPaths.coverLetterTemplatesGuidance, "modern-letter");

    const templates = await listRegisteredTemplates();
    expect(templates.find((t) => t.name === "awesome-cv")).toMatchObject({
      type: "cv",
      active: true,
    });
    expect(templates.find((t) => t.name === "modern-letter")).toMatchObject({
      type: "cover_letters",
      active: true,
    });
  });

  test("a folder with no TEMPLATE.md is skipped rather than crashing", async () => {
    mkdirSync(path.join(testDir, "templates", "cv", "incomplete"), { recursive: true });
    writeManifest("cv", "awesome-cv");

    const templates = await listRegisteredTemplates();
    expect(templates.map((t) => t.name)).toEqual(["awesome-cv"]);
  });

  test("results are sorted by name", async () => {
    writeManifest("cv", "zeta-cv");
    writeManifest("cv", "alpha-cv");

    const templates = await listRegisteredTemplates();
    expect(templates.map((t) => t.name)).toEqual(["alpha-cv", "zeta-cv"]);
  });
});
