import { existsSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";

const DOCUMENT_FOLDERS = [
  "cv",
  "linkedin",
  "diplomas",
  "references",
  "postings",
] as const;
export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];

export function isDocumentFolder(value: string): value is DocumentFolder {
  return (DOCUMENT_FOLDERS as readonly string[]).includes(value);
}

function sanitizeFilename(name: string): string {
  const base = path
    .basename(name)
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .trim();
  return base || "upload";
}

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

async function saveFileToDir(
  dir: string,
  filename: string,
  data: Uint8Array,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const safeName = sanitizeFilename(filename);
  const target = path.join(dir, safeName);
  if (target === dir || !target.startsWith(dir + path.sep)) {
    throw new Error("invalid filename");
  }
  await writeFile(target, data);
  return safeName;
}

async function deleteFileFromDir(
  dir: string,
  filename: string,
): Promise<boolean> {
  const target = path.join(dir, sanitizeFilename(filename));
  if (
    target === dir ||
    !target.startsWith(dir + path.sep) ||
    !existsSync(target)
  )
    return false;
  await unlink(target);
  return true;
}

export async function listDocuments(): Promise<
  Record<DocumentFolder, string[]>
> {
  const result = {} as Record<DocumentFolder, string[]>;
  for (const folder of DOCUMENT_FOLDERS) {
    result[folder] = await listFilesInDir(
      path.join(paths.repoRoot, "documents", folder),
    );
  }
  return result;
}

export async function saveDocument(
  folder: DocumentFolder,
  filename: string,
  data: Uint8Array,
): Promise<string> {
  return saveFileToDir(
    path.join(paths.repoRoot, "documents", folder),
    filename,
    data,
  );
}

export async function deleteDocument(
  folder: DocumentFolder,
  filename: string,
): Promise<boolean> {
  return deleteFileFromDir(
    path.join(paths.repoRoot, "documents", folder),
    filename,
  );
}

export async function listUploads(category: string): Promise<string[]> {
  return listFilesInDir(path.join(paths.uploadsDir, category));
}

export async function saveUpload(
  category: string,
  filename: string,
  data: Uint8Array,
): Promise<string> {
  return saveFileToDir(path.join(paths.uploadsDir, category), filename, data);
}

export async function deleteUpload(
  category: string,
  filename: string,
): Promise<boolean> {
  return deleteFileFromDir(path.join(paths.uploadsDir, category), filename);
}
