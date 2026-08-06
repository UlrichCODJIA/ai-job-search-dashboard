import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, matchEol, withFileLock } from "./fs.js";
import {
  parseMarkdownDocument,
  splitMarkdownSections,
  stringifyMarkdownDocument,
  type MarkdownSection,
} from "./markdown.js";
import { paths } from "./paths.js";

const SKILL_FILES = [
  "01-candidate-profile.md",
  "02-behavioral-profile.md",
  "04-job-evaluation.md",
  "05-cv-templates.md",
  "07-interview-prep.md",
] as const;

const CLAUDE_MD_KEY = "CLAUDE.md";
const EDITABLE_FILES = new Set<string>([CLAUDE_MD_KEY, ...SKILL_FILES]);

function additionalPlaceholderScanFiles(): { label: string; path: string }[] {
  return [
    { label: "cv/main_example.tex", path: paths.cvMainExample },
    { label: "search-queries.md", path: paths.searchQueries },
  ];
}

function resolveEditableFile(file: string): string {
  if (!EDITABLE_FILES.has(file)) {
    throw new Error(`unknown profile file: ${file}`);
  }
  return file === CLAUDE_MD_KEY
    ? paths.claudeMd
    : path.join(paths.profileSkillsDir, file);
}

const PLACEHOLDER_PATTERNS = [
  /\[YOUR_[A-Z_]+\]/g,
  /\[PLACEHOLDER\]/g,
  /<!-- SETUP[^>]*-->/g,
];

export interface PlaceholderHit {
  file: string;
  match: string;
  line: number;
}

export interface ProfileData {
  name: string | null;
  claudeMdSections: MarkdownSection[];
  skillFiles: { filename: string; sections: MarkdownSection[] }[];
  placeholders: PlaceholderHit[];
}

function extractCandidateName(claudeMdText: string): string | null {
  const match = claudeMdText.match(/^\s*-\s*\*\*Name:\*\*\s*(.+)$/m);
  if (!match) return null;
  const name = match[1].split("(")[0].trim();
  return name || null;
}

function findPlaceholders(file: string, text: string): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  text.split("\n").forEach((line, i) => {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      for (const match of line.match(pattern) ?? []) {
        hits.push({ file, match, line: i + 1 });
      }
    }
  });
  return hits;
}

export async function getProfileData(): Promise<ProfileData> {
  const claudeMdText = existsSync(paths.claudeMd)
    ? await readFile(paths.claudeMd, "utf-8")
    : "";
  const placeholders = findPlaceholders("CLAUDE.md", claudeMdText);

  const skillFiles: { filename: string; sections: MarkdownSection[] }[] = [];
  for (const filename of SKILL_FILES) {
    const filePath = path.join(paths.profileSkillsDir, filename);
    if (!existsSync(filePath)) continue;
    const text = await readFile(filePath, "utf-8");
    skillFiles.push({ filename, sections: splitMarkdownSections(text) });
    placeholders.push(...findPlaceholders(filename, text));
  }

  for (const { label, path: filePath } of additionalPlaceholderScanFiles()) {
    if (!existsSync(filePath)) continue;
    const text = await readFile(filePath, "utf-8");
    placeholders.push(...findPlaceholders(label, text));
  }

  return {
    name: extractCandidateName(claudeMdText),
    claudeMdSections: splitMarkdownSections(claudeMdText),
    skillFiles,
    placeholders,
  };
}

interface MarkerCheck {
  file: string;
  phrase: string;
  pattern: RegExp;
  warning: string;
}

// These two lines are the only places a free-text edit through this editor
// can silently break something another part of the dashboard depends on
// parsing back out.
const MARKER_CHECKS: MarkerCheck[] = [
  {
    file: CLAUDE_MD_KEY,
    phrase: "**Name:**",
    pattern: /^\s*-\s*\*\*Name:\*\*\s*(.+)$/m,
    warning:
      'This save no longer has a recognizable "- **Name:** ..." line, which the dashboard uses to show your name on the Profile page.',
  },
  {
    file: "05-cv-templates.md",
    phrase: "Active template override",
    pattern: /Active template override:\s*`([^`]+)`/,
    warning:
      "The \"Active template override\" line looks malformed after this edit -- the dashboard needs the template name wrapped in backticks (e.g. `Active template override: `modern``) to detect which CV template is active.",
  },
];

export function checkKnownMarker(
  file: string,
  before: string,
  after: string,
): string | undefined {
  const check = MARKER_CHECKS.find((m) => m.file === file);
  if (!check) return undefined;
  const wasPresent = before.includes(check.phrase);
  const stillPresentAsText = after.includes(check.phrase);
  const stillParses = check.pattern.test(after);
  return wasPresent && stillPresentAsText && !stillParses
    ? check.warning
    : undefined;
}

export class ProfileSectionConflictError extends Error {
  constructor(
    public readonly expectedHeading: string,
    public readonly actualHeading: string | undefined,
  ) {
    super(
      actualHeading === undefined
        ? `This section ("${expectedHeading}") no longer exists at that position -- the document changed since you opened it. Reload the page and try again.`
        : `This section changed since you opened it: expected "${expectedHeading}" but found "${actualHeading}" in its place. Reload the page and try again.`,
    );
    this.name = "ProfileSectionConflictError";
  }
}

export async function updateProfileSection(
  file: string,
  sectionIndex: number,
  expectedHeading: string,
  content: string,
): Promise<{ warning?: string }> {
  const filePath = resolveEditableFile(file);
  return withFileLock(filePath, async () => {
    const rawText = existsSync(filePath)
      ? await readFile(filePath, "utf-8")
      : "";
    const doc = parseMarkdownDocument(rawText);

    if (sectionIndex < 0 || sectionIndex >= doc.sections.length) {
      throw new Error(`section index ${sectionIndex} out of range for ${file}`);
    }
    const current = doc.sections[sectionIndex];
    if (current?.heading !== expectedHeading) {
      throw new ProfileSectionConflictError(expectedHeading, current?.heading);
    }
    doc.sections[sectionIndex] = {
      ...current,
      content: content.trim(),
    };
    const rewritten = stringifyMarkdownDocument(doc);
    const warning = checkKnownMarker(file, rawText, rewritten);
    await atomicWriteFile(filePath, matchEol(rewritten, rawText));
    return { warning };
  });
}
