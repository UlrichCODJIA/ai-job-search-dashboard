import { describe, expect, test } from "bun:test";
import { extractSection, splitMarkdownSections } from "../src/lib/markdown.js";

// Framework skill files in this repo are checked out with CRLF line endings on
// Windows. JS regex `.` never matches `\r`, so an un-normalized `\r` at the end
// of every line silently breaks any `$`-anchored heading/table match -- this
// previously made splitMarkdownSections and extractSection return nothing at
// all for CRLF files (e.g. 05-cv-templates.md), even though the file read fine.
describe("splitMarkdownSections", () => {
  test("parses headings with LF line endings", () => {
    const sections = splitMarkdownSections("# Title\n\nBody text.\n\n## Sub\n\nMore.\n");
    expect(sections.map((s) => s.heading)).toEqual(["Title", "Sub"]);
    expect(sections[0].content).toBe("Body text.");
  });

  test("parses headings with CRLF line endings", () => {
    const sections = splitMarkdownSections("# Title\r\n\r\nBody text.\r\n\r\n## Sub\r\n\r\nMore.\r\n");
    expect(sections.map((s) => s.heading)).toEqual(["Title", "Sub"]);
    expect(sections[0].content).toBe("Body text.");
    expect(sections[1].content).toBe("More.");
  });
});

describe("extractSection", () => {
  test("extracts a section body with CRLF line endings", () => {
    const text = "## Gap Heatmap\r\n\r\n| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n\r\n## Learning Plan\r\n\r\nx\r\n";
    const section = extractSection(text, "Gap Heatmap");
    expect(section).toContain("| 1 | 2 |");
    expect(section).not.toContain("Learning Plan");
  });
});
