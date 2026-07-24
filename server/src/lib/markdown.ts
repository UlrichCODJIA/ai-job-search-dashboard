export interface MarkdownSection {
  level: number;
  heading: string;
  content: string;
}

/** Splits a markdown document into sections at each ATX heading (`#`..`######`). */
export function splitMarkdownSections(text: string): MarkdownSection[] {
  return parseMarkdownDocument(text).sections;
}

/** Extracts the body of a single `## <heading>` section, up to the next `##` heading or end of text. */
export function extractSection(text: string, heading: string): string | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`);
  const match = normalized.match(re);
  return match ? match[1].trim() : null;
}

export interface MarkdownDocument {
  /** Raw text before the first heading (e.g. YAML frontmatter), preserved verbatim
   * so a section edit + rewrite never silently drops it. */
  preamble: string;
  sections: MarkdownSection[];
}

/** Walks the document once, splitting it into heading-delimited sections while
 * also keeping the pre-heading preamble (splitMarkdownSections discards it) so
 * writeMarkdownDocument can round-trip losslessly. */
export function parseMarkdownDocument(text: string): MarkdownDocument {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  const preambleLines: string[] = [];
  let current: MarkdownSection | null = null;

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { level: heading[1].length, heading: heading[2].trim(), content: "" };
    } else if (current) {
      current.content += line + "\n";
    } else {
      preambleLines.push(line);
    }
  }
  if (current) sections.push(current);

  return {
    preamble: preambleLines.join("\n").trim(),
    sections: sections.map((s) => ({ ...s, content: s.content.trim() })),
  };
}

/** Inverse of parseMarkdownDocument: reconstructs a full markdown file from its
 * preamble + ordered sections. Only section *content* is expected to change
 * between parse and write; heading text/level and section order are preserved. */
export function stringifyMarkdownDocument(doc: MarkdownDocument): string {
  const parts: string[] = [];
  if (doc.preamble) parts.push(doc.preamble);
  for (const s of doc.sections) {
    const headingLine = `${"#".repeat(s.level)} ${s.heading}`;
    parts.push(s.content ? `${headingLine}\n\n${s.content}` : headingLine);
  }
  return parts.join("\n\n") + "\n";
}

export function parseMarkdownTableRows(section: string): string[][] {
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  if (lines.length < 2) return [];
  return lines
    .slice(1)
    .filter((l) => !/^\|[\s-:|]+\|$/.test(l))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
}
