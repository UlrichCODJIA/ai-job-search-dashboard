import { unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { acquireFileLock } from "./fs.js";
import { paths } from "./paths.js";

export class AnotherInstanceRunningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnotherInstanceRunningError";
  }
}

function lockFilePath(): string {
  return `${paths.instanceLock}.lock`;
}

function releaseSync(): void {
  try {
    unlinkSync(lockFilePath());
  } catch {
  }
}

export async function acquireInstanceLock(): Promise<void> {
  try {
    await acquireFileLock(paths.instanceLock, {
      maxWaitMs: 0,
      retryMs: 0,
      staleMs: Infinity,
    });
  } catch {
    const ownerPid = await readFile(lockFilePath(), "utf-8")
      .then((content) => content.trim())
      .catch(() => "unknown");
    throw new AnotherInstanceRunningError(
      `Another dashboard server (pid ${ownerPid}) is already running against this same data directory (${paths.repoRoot}). Stop it before starting a new one -- two instances writing to the same files at once isn't safe.`,
    );
  }

  process.on("exit", releaseSync);
  process.on("SIGINT", () => {
    releaseSync();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    releaseSync();
    process.exit(0);
  });
}
