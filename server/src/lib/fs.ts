import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function atomicWriteFile(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
}

export function matchEol(content: string, sourceText: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  return sourceText.includes("\r\n")
    ? normalized.replace(/\n/g, "\r\n")
    : normalized;
}

const fileLockTails = new Map<string, Promise<void>>();

export function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previousTail = fileLockTails.get(filePath) ?? Promise.resolve();
  const result = previousTail.then(fn, fn);
  fileLockTails.set(
    filePath,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
