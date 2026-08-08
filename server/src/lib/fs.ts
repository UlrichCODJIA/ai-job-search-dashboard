import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const TRANSIENT_FS_RETRY_DELAYS_MS = [20, 40, 80, 160, 320];

function isTransientFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  return code === "EPERM" || code === "EBUSY";
}

async function retryOnTransientFsError<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= TRANSIENT_FS_RETRY_DELAYS_MS.length || !isTransientFsError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, TRANSIENT_FS_RETRY_DELAYS_MS[attempt]));
    }
  }
}

export async function atomicWriteFile(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, content, "utf-8");
  try {
    await retryOnTransientFsError(() => rename(tmpPath, filePath));
  } catch (err) {
    await unlink(tmpPath).catch(() => undefined);
    throw err;
  }
}

export function matchEol(content: string, sourceText: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  return sourceText.includes("\r\n")
    ? normalized.replace(/\n/g, "\r\n")
    : normalized;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 100;
const LOCK_MAX_WAIT_MS = 10_000;

export async function acquireFileLock(
  filePath: string,
  opts: { staleMs?: number; retryMs?: number; maxWaitMs?: number } = {},
): Promise<() => Promise<void>> {
  const staleMs = opts.staleMs ?? LOCK_STALE_MS;
  const retryMs = opts.retryMs ?? LOCK_RETRY_MS;
  const maxWaitMs = opts.maxWaitMs ?? LOCK_MAX_WAIT_MS;

  const lockPath = `${filePath}.lock`;
  await mkdir(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + maxWaitMs;

  for (;;) {
    try {
      await retryOnTransientFsError(() =>
        writeFile(lockPath, String(process.pid), {
          encoding: "utf-8",
          flag: "wx",
        }),
      );
      return () => unlink(lockPath).catch(() => undefined);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }

    let abandoned = false;
    try {
      const [content, stats] = await Promise.all([
        readFile(lockPath, "utf-8"),
        stat(lockPath),
      ]);
      const ownerPid = Number.parseInt(content, 10);
      const ownerGone = !Number.isFinite(ownerPid) || !isProcessAlive(ownerPid);
      const age = Date.now() - stats.mtimeMs;
      abandoned = ownerGone || age > staleMs;
    } catch {
      abandoned = true;
    }

    if (abandoned) {
      await unlink(lockPath).catch(() => undefined);
      continue;
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for a lock on ${path.basename(filePath)} -- another process (or the claude CLI) appears to be writing to it. Try again in a moment.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
}

const fileLockTails = new Map<string, Promise<void>>();

export function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previousTail = fileLockTails.get(filePath) ?? Promise.resolve();
  const runLocked = async () => {
    const release = await acquireFileLock(filePath);
    try {
      return await fn();
    } finally {
      await release();
    }
  };
  const result = previousTail.then(runLocked, runLocked);
  fileLockTails.set(
    filePath,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
