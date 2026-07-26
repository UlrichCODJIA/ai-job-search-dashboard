import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { atomicWriteFile, withFileLock } from "./fs.js";
import { paths } from "./paths.js";

export interface ClaudeSettings {
  allow: string[];
}

async function readRawSettings(): Promise<Record<string, unknown>> {
  if (!existsSync(paths.claudeSettings)) return {};
  const text = await readFile(paths.claudeSettings, "utf-8");
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `invalid JSON in settings.json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getSettings(): Promise<ClaudeSettings> {
  const raw = await readRawSettings();
  const permissions = raw.permissions as { allow?: unknown } | undefined;
  const allow = Array.isArray(permissions?.allow)
    ? (permissions.allow as string[])
    : [];
  return { allow };
}

export async function updateSettings(allow: string[]): Promise<ClaudeSettings> {
  return withFileLock(paths.claudeSettings, async () => {
    const raw = await readRawSettings();
    const permissions =
      (raw.permissions as Record<string, unknown> | undefined) ?? {};
    const next = { ...raw, permissions: { ...permissions, allow } };
    await atomicWriteFile(
      paths.claudeSettings,
      `${JSON.stringify(next, null, 2)}\n`,
    );
    return { allow };
  });
}
