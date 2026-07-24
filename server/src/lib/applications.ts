import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";
import { parseOutcomeMarkdown, type OutcomeRecord } from "./outcome.js";
import { listTrackerRows, type TrackerRow } from "./tracker.js";

export interface ApplicationRecord {
  slug: string;
  companySlug: string;
  roleSlug: string;
  outcome: OutcomeRecord | null;
  hasJobPosting: boolean;
  hasCvDraft: boolean;
  hasCoverLetter: boolean;
  trackerRow: TrackerRow | null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// documents/applications/<company>_<role>/ -- lowercase, underscores for spaces
// (documents/README.md's naming convention). Company/role split is best-effort:
// the tracker cross-reference below is fuzzy (substring match on the company slug)
// since the folder name doesn't carve an unambiguous boundary.
function splitSlug(slug: string): { companySlug: string; roleSlug: string } {
  const [companySlug, ...roleParts] = slug.split("_");
  return { companySlug: companySlug ?? slug, roleSlug: roleParts.join("_") };
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
      const normalizedCompany = normalize(companySlug);
      const trackerRow =
        trackerRows.find((row) => {
          const rowCompany = normalize(row.company ?? "");
          return (
            rowCompany.length > 0 &&
            (rowCompany.includes(normalizedCompany) || normalizedCompany.includes(rowCompany))
          );
        }) ?? null;

      return {
        slug,
        companySlug,
        roleSlug,
        outcome,
        hasJobPosting: existsSync(path.join(dir, "job_posting.md")),
        hasCvDraft: existsSync(path.join(dir, "cv_draft.tex")),
        hasCoverLetter: existsSync(path.join(dir, "cover_letter.tex")),
        trackerRow,
      };
    }),
  );
}
