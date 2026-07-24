import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Writes via a temp file + rename so a reader never observes a half-written file. */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
}

/** Browser <textarea> values are always LF-only (the DOM normalizes CR/CRLF on
 * read), so any edit round-tripped through one silently flips a CRLF file to
 * LF -- a one-character content fix would otherwise show as a whole-file diff.
 * Re-apply whatever line ending the source file was already using. */
export function matchEol(content: string, sourceText: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  return sourceText.includes("\r\n") ? normalized.replace(/\n/g, "\r\n") : normalized;
}

// Per-path queue of the tail of the lock chain for that path. Always holds a
// promise that *resolves* (never rejects) once its slot in the queue is done,
// so one failed operation doesn't permanently wedge later queued callers.
const fileLockTails = new Map<string, Promise<void>>();

/** Serializes read-modify-write operations against the same file path so two
 * concurrent callers can no longer interleave their read before either writes
 * (a "lost update"): everything queued behind the same `filePath` runs one at
 * a time, in call order, each awaiting the previous one's full completion
 * (including its write) before starting its own read. Complements
 * atomicWriteFile (which only makes a single write itself atomic) rather than
 * duplicating it -- call sites still do their own read + write inside `fn`.
 *
 * Scoping: this is an in-process async mutex only -- it serializes concurrent
 * callers *within this Node/Bun process* (e.g. two overlapping dashboard HTTP
 * requests, or two open browser tabs both hitting the same endpoint). It
 * provides no protection against a *separate* OS process racing on the same
 * file, such as a running Claude Agent SDK tool call (`/scrape`, `/apply`,
 * `/setup`, etc.) using its own Read/Write/Edit tools concurrently with a
 * dashboard request. For files this process exclusively writes (e.g.
 * runs.json, salary_data.json), that narrower guarantee is the whole story.
 * For files also written by an out-of-process agent tool call, this lock
 * still closes the narrower "two concurrent dashboard callers" race, but does
 * NOT close the larger race against that sibling process -- a different
 * problem this mechanism doesn't solve. */
export function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
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
