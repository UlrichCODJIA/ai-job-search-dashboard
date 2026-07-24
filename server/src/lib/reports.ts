import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { listFilesInDir } from "./documents.js";
import { paths } from "./paths.js";

export interface ReportFile {
  filename: string;
  modifiedAt: number;
}

/** /html-report's default output (html-report.md Step 0: no argument -> writes
 * reports/application-dashboard.html). A run given a custom output path writes
 * somewhere else entirely and won't show up here -- that's an intentional
 * scope limit, not a bug: serving an arbitrary filesystem path the user typed
 * into a command's free-text args isn't something this route can safely do. */
export async function listReports(): Promise<ReportFile[]> {
  const filenames = (await listFilesInDir(paths.reportsDir)).filter((f) => f.endsWith(".html"));
  return filenames
    .map((filename) => ({
      filename,
      modifiedAt: statSync(path.join(paths.reportsDir, filename)).mtimeMs,
    }))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/** Resolves `filename` to a path inside reportsDir, or null if it doesn't
 * exist / isn't a .html file. path.basename strips any directory components
 * from `filename` before it ever touches the filesystem, so the result can
 * only ever be a direct child of reportsDir. */
export function resolveReportPath(filename: string): string | null {
  if (!filename.endsWith(".html")) return null;
  const target = path.join(paths.reportsDir, path.basename(filename));
  if (!existsSync(target)) return null;
  return target;
}
