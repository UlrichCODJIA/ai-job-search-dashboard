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

function resolveEditableFile(file: string): string {
  if (!EDITABLE_FILES.has(file)) {
    throw new Error(`unknown profile file: ${file}`);
  }
  return file === CLAUDE_MD_KEY ? paths.claudeMd : path.join(paths.profileSkillsDir, file);
}

const PLACEHOLDER_PATTERNS = [/\[YOUR_[A-Z_]+\]/g, /\[PLACEHOLDER\]/g, /<!-- SETUP[^>]*-->/g];

export interface PlaceholderHit {
  file: string;
  match: string;
  line: number;
}

export interface ProfileData {
  claudeMdSections: MarkdownSection[];
  skillFiles: { filename: string; sections: MarkdownSection[] }[];
  placeholders: PlaceholderHit[];
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
  const claudeMdText = existsSync(paths.claudeMd) ? await readFile(paths.claudeMd, "utf-8") : "";
  const placeholders = findPlaceholders("CLAUDE.md", claudeMdText);

  const skillFiles: { filename: string; sections: MarkdownSection[] }[] = [];
  for (const filename of SKILL_FILES) {
    const filePath = path.join(paths.profileSkillsDir, filename);
    if (!existsSync(filePath)) continue;
    const text = await readFile(filePath, "utf-8");
    skillFiles.push({ filename, sections: splitMarkdownSections(text) });
    placeholders.push(...findPlaceholders(filename, text));
  }

  return {
    claudeMdSections: splitMarkdownSections(claudeMdText),
    skillFiles,
    placeholders,
  };
}

/** Rewrites one section's body in place. Re-parses the file fresh from disk (not
 * from whatever the client last saw) so the preamble and every other section's
 * content are always preserved exactly, even if the file changed since the last
 * GET /api/profile. */
export async function updateProfileSection(
  file: string,
  sectionIndex: number,
  content: string,
): Promise<void> {
  const filePath = resolveEditableFile(file);
  return withFileLock(filePath, async () => {
    const rawText = existsSync(filePath) ? await readFile(filePath, "utf-8") : "";
    const doc = parseMarkdownDocument(rawText);

    if (sectionIndex < 0 || sectionIndex >= doc.sections.length) {
      throw new Error(`section index ${sectionIndex} out of range for ${file}`);
    }
    doc.sections[sectionIndex] = { ...doc.sections[sectionIndex], content: content.trim() };
    const rewritten = stringifyMarkdownDocument(doc);
    await atomicWriteFile(filePath, matchEol(rewritten, rawText));
  });
}
