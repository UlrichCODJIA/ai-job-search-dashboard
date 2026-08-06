import { existsSync } from "node:fs";
import path from "node:path";
import { paths } from "./paths.js";

const TRACKER_FILE_FOLDERS = new Set(["cv", "cover_letters"]);
const TRACKER_FILENAME_PATTERN = /^(main|cover)_[a-z0-9_]+\.(tex|pdf)$/i;

export function resolveTrackerFilePath(
  folder: string,
  filename: string,
): string | null {
  if (!TRACKER_FILE_FOLDERS.has(folder)) return null;
  if (!TRACKER_FILENAME_PATTERN.test(filename)) return null;
  const target = path.join(paths.repoRoot, folder, path.basename(filename));
  if (!existsSync(target)) return null;
  return target;
}

export function pdfSiblingPath(texRelativePath: string): string | null {
  if (!texRelativePath.endsWith(".tex")) return null;
  const pdfRelativePath = `${texRelativePath.slice(0, -4)}.pdf`;
  const [folder, ...rest] = pdfRelativePath.split("/");
  const filename = rest.join("/");
  return resolveTrackerFilePath(folder, filename) ? pdfRelativePath : null;
}
