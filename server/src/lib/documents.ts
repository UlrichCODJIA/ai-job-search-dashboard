import { existsSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";

// Mirrors documents/README.md's folder layout -- the five subfolders that
// accept a plain uploaded file. applications/ is excluded: it's structured
// record-keeping (one subfolder per application, populated by /outcome), not
// a drop target for an arbitrary uploaded file. postings/ *is* a drop target
// (documents/README.md: "paste the full text into a .txt file here"), it just
// requires the filename itself to be the exact job title -- the existing
// upload flow already preserves the uploaded file's own name, so this needs
// no special handling beyond being listed here.
const DOCUMENT_FOLDERS = ["cv", "linkedin", "diplomas", "references", "postings"] as const;
export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];

export function isDocumentFolder(value: string): value is DocumentFolder {
  return (DOCUMENT_FOLDERS as readonly string[]).includes(value);
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  return base || "upload";
}

/** Lists the plain (non-dotfile) files directly inside `dir`, or [] if it
 * doesn't exist / can't be read. */
export async function listFilesInDir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** Sanitizes `filename` and writes `data` into `dir` (created if missing),
 * rejecting any name that would escape `dir`. Returns the sanitized name. */
async function saveFileToDir(dir: string, filename: string, data: Uint8Array): Promise<string> {
  await mkdir(dir, { recursive: true });
  const safeName = sanitizeFilename(filename);
  const target = path.join(dir, safeName);
  // sanitizeFilename allows "." in its character class, and a name of exactly
  // "." or ".." resolves (via path.basename/path.join) to the folder itself or
  // its parent -- the same containment check delete*() already relies on
  // (extended with the dir-itself case, since "." collapses to no subpath).
  if (target === dir || !target.startsWith(dir + path.sep)) {
    throw new Error("invalid filename");
  }
  await writeFile(target, data);
  return safeName;
}

/** Unlinks `filename` from `dir` if it exists and stays contained in `dir`. */
async function deleteFileFromDir(dir: string, filename: string): Promise<boolean> {
  const target = path.join(dir, sanitizeFilename(filename));
  // sanitizeFilename allows "." in its character class, so a filename of
  // exactly "." collapses to `dir` itself (path.join(dir, ".") === dir) --
  // that passed the old `!target.startsWith(dir)` check (dir does start with
  // dir) and `existsSync` (the directory exists), reaching `unlink(dir)`,
  // which throws EPERM and -- since neither DELETE route wraps this in
  // try/catch -- surfaced Bun's crash page with the absolute repo path and
  // this file's source back to the client. Matches saveFileToDir's guard.
  if (target === dir || !target.startsWith(dir + path.sep) || !existsSync(target)) return false;
  await unlink(target);
  return true;
}

export async function listDocuments(): Promise<Record<DocumentFolder, string[]>> {
  const result = {} as Record<DocumentFolder, string[]>;
  for (const folder of DOCUMENT_FOLDERS) {
    result[folder] = await listFilesInDir(path.join(paths.repoRoot, "documents", folder));
  }
  return result;
}

export async function saveDocument(folder: DocumentFolder, filename: string, data: Uint8Array): Promise<string> {
  return saveFileToDir(path.join(paths.repoRoot, "documents", folder), filename, data);
}

export async function deleteDocument(folder: DocumentFolder, filename: string): Promise<boolean> {
  return deleteFileFromDir(path.join(paths.repoRoot, "documents", folder), filename);
}

// Staging area for the "generate a template from an example" feature (see
// /add-template Step 1.5 and /setup --section cv) -- deliberately kept
// outside documents/, since that tree is specifically the four folders
// documented in documents/README.md that /setup Path A scans, and a cover
// letter *example to copy the structure of* isn't a profile source document.
// Lives alongside this dashboard's own files (paths.uploadsDir), not inside
// the ai-job-search checkout -- the two aren't necessarily the same directory
// tree once this dashboard is run standalone, pointed at a checkout via
// AI_JOB_SEARCH_ROOT.
export async function listUploads(category: string): Promise<string[]> {
  return listFilesInDir(path.join(paths.uploadsDir, category));
}

export async function saveUpload(category: string, filename: string, data: Uint8Array): Promise<string> {
  return saveFileToDir(path.join(paths.uploadsDir, category), filename, data);
}

export async function deleteUpload(category: string, filename: string): Promise<boolean> {
  return deleteFileFromDir(path.join(paths.uploadsDir, category), filename);
}
