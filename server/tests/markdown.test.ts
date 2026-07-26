import { describe, expect, test } from "bun:test";
import { extractSection, splitMarkdownSections } from "../src/lib/markdown.js";

describe("splitMarkdownSections", () => {
  test("parses headings with LF line endings", () => {
    const sections = splitMarkdownSections(
      "# Title\n\nBody text.\n\n## Sub\n\nMore.\n",
    );
    expect(sections.map((s) => s.heading)).toEqual(["Title", "Sub"]);
    expect(sections[0].content).toBe("Body text.");
  });

  test("parses headings with CRLF line endings", () => {
    const sections = splitMarkdownSections(
      "# Title\r\n\r\nBody text.\r\n\r\n## Sub\r\n\r\nMore.\r\n",
    );
    expect(sections.map((s) => s.heading)).toEqual(["Title", "Sub"]);
    expect(sections[0].content).toBe("Body text.");
    expect(sections[1].content).toBe("More.");
  });
});

describe("extractSection", () => {
  test("extracts a section body with CRLF line endings", () => {
    const text =
      "## Gap Heatmap\r\n\r\n| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n\r\n## Learning Plan\r\n\r\nx\r\n";
    const section = extractSection(text, "Gap Heatmap");
    expect(section).toContain("| 1 | 2 |");
    expect(section).not.toContain("Learning Plan");
  });
});
