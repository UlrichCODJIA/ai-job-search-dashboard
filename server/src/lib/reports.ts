import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { listFilesInDir } from "./documents.js";
import { paths } from "./paths.js";

export interface ReportFile {
  filename: string;
  modifiedAt: number;
}

export async function listReports(): Promise<ReportFile[]> {
  const filenames = (await listFilesInDir(paths.reportsDir)).filter((f) =>
    f.endsWith(".html"),
  );
  return filenames
    .map((filename) => ({
      filename,
      modifiedAt: statSync(path.join(paths.reportsDir, filename)).mtimeMs,
    }))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export function resolveReportPath(filename: string): string | null {
  if (!filename.endsWith(".html")) return null;
  const target = path.join(paths.reportsDir, path.basename(filename));
  if (!existsSync(target)) return null;
  return target;
}
