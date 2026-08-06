import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";
import { parseOutcomeMarkdown, type OutcomeRecord } from "./outcome.js";
import { listTrackerRows, type TrackerRow } from "./tracker.js";

export interface InterviewPrepFile {
  stage: string;
  hasPrepPack: boolean;
  hasCheatSheet: boolean;
}

export interface ApplicationRecord {
  slug: string;
  companySlug: string;
  roleSlug: string;
  outcome: OutcomeRecord | null;
  hasJobPosting: boolean;
  hasCvDraft: boolean;
  hasCoverLetter: boolean;
  interviewPrep: InterviewPrepFile[];
  trackerRow: TrackerRow | null;
}

const INTERVIEW_PREP_PATTERN = /^interview_prep_(.+)\.md$/;
const INTERVIEW_CHEATSHEET_PATTERN = /^interview_cheatsheet_(.+)\.md$/;

const DOWNLOADABLE_FILENAME_PATTERN =
  /^(job_posting\.md|cv_draft\.tex|cover_letter\.tex|outcome\.md|interview_prep_.+\.md|interview_cheatsheet_.+\.md)$/;

export function resolveApplicationFilePath(
  slug: string,
  filename: string,
): string | null {
  if (!DOWNLOADABLE_FILENAME_PATTERN.test(filename)) return null;
  const target = path.join(
    paths.applicationsDir,
    path.basename(slug),
    path.basename(filename),
  );
  if (!existsSync(target)) return null;
  return target;
}

export function parseInterviewPrepFiles(filenames: string[]): InterviewPrepFile[] {
  const stages = new Map<string, InterviewPrepFile>();
  for (const name of filenames) {
    const prepMatch = name.match(INTERVIEW_PREP_PATTERN);
    const cheatMatch = name.match(INTERVIEW_CHEATSHEET_PATTERN);
    const stage = prepMatch?.[1] ?? cheatMatch?.[1];
    if (!stage) continue;
    const entry = stages.get(stage) ?? { stage, hasPrepPack: false, hasCheatSheet: false };
    if (prepMatch) entry.hasPrepPack = true;
    if (cheatMatch) entry.hasCheatSheet = true;
    stages.set(stage, entry);
  }
  return [...stages.values()];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitSlug(slug: string): { companySlug: string; roleSlug: string } {
  const [companySlug, ...roleParts] = slug.split("_");
  return { companySlug: companySlug ?? slug, roleSlug: roleParts.join("_") };
}

export function findTrackerRowForCompany(
  companySlug: string,
  trackerRows: TrackerRow[],
): TrackerRow | null {
  const normalizedCompany = normalize(companySlug);
  if (normalizedCompany.length === 0) return null;

  const exactMatch = trackerRows.find(
    (row) => normalize(row.company ?? "") === normalizedCompany,
  );
  if (exactMatch) return exactMatch;

  const substringMatches = trackerRows.filter((row) => {
    const rowCompany = normalize(row.company ?? "");
    return (
      rowCompany.length > 0 &&
      (rowCompany.includes(normalizedCompany) ||
        normalizedCompany.includes(rowCompany))
    );
  });
  return substringMatches.length === 1 ? substringMatches[0] : null;
}

export async function listApplications(): Promise<ApplicationRecord[]> {
  if (!existsSync(paths.applicationsDir)) return [];
  const entries = await readdir(paths.applicationsDir, { withFileTypes: true });
  const trackerRows = await listTrackerRows();

  const directories = entries.filter((entry) => entry.isDirectory());
  return Promise.all(
    directories.map(async (entry) => {
      const slug = entry.name;
      const dir = path.join(paths.applicationsDir, slug);
      const outcomePath = path.join(dir, "outcome.md");

      const outcome = existsSync(outcomePath)
        ? parseOutcomeMarkdown(await readFile(outcomePath, "utf-8"))
        : null;

      const { companySlug, roleSlug } = splitSlug(slug);
      const trackerRow = findTrackerRowForCompany(companySlug, trackerRows);
      const dirFiles = await readdir(dir);

      return {
        slug,
        companySlug,
        roleSlug,
        outcome,
        hasJobPosting: existsSync(path.join(dir, "job_posting.md")),
        hasCvDraft: existsSync(path.join(dir, "cv_draft.tex")),
        hasCoverLetter: existsSync(path.join(dir, "cover_letter.tex")),
        interviewPrep: parseInterviewPrepFiles(dirFiles),
        trackerRow,
      };
    }),
  );
}
