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
    // Thrown (not silently defaulted): this file is hand-edited, and updateSettings()
    // reads-modifies-writes it -- a silent {} fallback would clobber the user's
    // existing hooks/env/etc. on the next PUT. Let the route turn this into a 400.
    throw new Error(`invalid JSON in settings.json: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getSettings(): Promise<ClaudeSettings> {
  const raw = await readRawSettings();
  const permissions = raw.permissions as { allow?: unknown } | undefined;
  const allow = Array.isArray(permissions?.allow) ? (permissions.allow as string[]) : [];
  return { allow };
}

/** Only ever touches permissions.allow -- every other top-level key in
 * settings.json (hooks, env, anything /setup or the user added by hand) is
 * read fresh from disk and passed through untouched. */
export async function updateSettings(allow: string[]): Promise<ClaudeSettings> {
  return withFileLock(paths.claudeSettings, async () => {
    const raw = await readRawSettings();
    const permissions = (raw.permissions as Record<string, unknown> | undefined) ?? {};
    const next = { ...raw, permissions: { ...permissions, allow } };
    await atomicWriteFile(paths.claudeSettings, `${JSON.stringify(next, null, 2)}\n`);
    return { allow };
  });
}
