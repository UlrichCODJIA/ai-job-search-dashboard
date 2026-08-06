import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, matchEol, withFileLock } from "./fs.js";
import { paths } from "./paths.js";

export type PortalHealthStatus = "ok" | "zero_results" | "error" | "skipped_disabled";

export interface PortalSkill {
  name: string;
  descriptionPreview: string;
  enabled: boolean;
  lastChecked?: string;
  lastResultCount?: number;
  healthStatus?: PortalHealthStatus;
}

interface PortalHealthEntry {
  last_checked?: string;
  last_result_count?: number;
  status?: PortalHealthStatus;
}

async function readPortalHealth(): Promise<Record<string, PortalHealthEntry>> {
  try {
    const text = await readFile(paths.portalHealth, "utf-8");
    const parsed = JSON.parse(text) as { portals?: Record<string, PortalHealthEntry> };
    return parsed.portals ?? {};
  } catch {
    return {};
  }
}

function extractFrontmatter(text: string): string | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : null;
}

function extractScalarField(
  frontmatter: string,
  field: string,
): string | undefined {
  const match = frontmatter.match(
    new RegExp(`^${field}:\\s*(.+?)\\s*(?:#.*)?$`, "m"),
  );
  return match?.[1]?.trim();
}

function extractDescriptionPreview(frontmatter: string): string {
  const blockMatch = frontmatter.match(
    /^description:\s*>-?\s*\r?\n((?:[ \t]+.*\r?\n?)+)/m,
  );
  if (blockMatch) {
    const firstLine = blockMatch[1].split(/\r?\n/)[0]?.trim();
    if (firstLine) return firstLine;
  }
  const inline = extractScalarField(frontmatter, "description");
  return inline?.replace(/^["']|["']$/g, "") ?? "";
}

export async function listPortalSkills(): Promise<PortalSkill[]> {
  let entries;
  try {
    entries = await readdir(paths.agentSkillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = entries.filter((e) => e.isDirectory());
  const health = await readPortalHealth();

  const skills = await Promise.all(
    dirs.map(async (dir): Promise<PortalSkill | null> => {
      const skillPath = path.join(paths.agentSkillsDir, dir.name, "SKILL.md");
      let text: string;
      try {
        text = await readFile(skillPath, "utf-8");
      } catch {
        return null;
      }
      const frontmatter = extractFrontmatter(text);
      if (!frontmatter) return null;
      const name = extractScalarField(frontmatter, "name") ?? dir.name;
      const enabledRaw = extractScalarField(frontmatter, "enabled");
      const entry = health[name];
      return {
        name,
        descriptionPreview: extractDescriptionPreview(frontmatter),
        enabled: enabledRaw !== "false",
        lastChecked: entry?.last_checked,
        lastResultCount: entry?.last_result_count,
        healthStatus: entry?.status,
      };
    }),
  );

  return skills
    .filter((s): s is PortalSkill => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function findPortalSkillDir(name: string): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(paths.agentSkillsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const dir of entries.filter((e) => e.isDirectory())) {
    const skillPath = path.join(paths.agentSkillsDir, dir.name, "SKILL.md");
    let text: string;
    try {
      text = await readFile(skillPath, "utf-8");
    } catch {
      continue;
    }
    const frontmatter = extractFrontmatter(text);
    if (!frontmatter) continue;
    const resolvedName = extractScalarField(frontmatter, "name") ?? dir.name;
    if (resolvedName === name) return dir.name;
  }
  return null;
}

export async function setPortalEnabled(
  name: string,
  enabled: boolean,
): Promise<void> {
  const dirName = await findPortalSkillDir(name);
  if (!dirName) throw new Error(`portal not found: ${name}`);
  const skillPath = path.join(paths.agentSkillsDir, dirName, "SKILL.md");

  await withFileLock(skillPath, async () => {
    const raw = await readFile(skillPath, "utf-8");
    const match = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
    if (!match) {
      throw new Error(`${dirName}/SKILL.md has no frontmatter block`);
    }
    const [full, open, frontmatter, close] = match;
    const rewrittenFrontmatter = /^enabled:\s*.*$/m.test(frontmatter)
      ? frontmatter.replace(/^enabled:\s*.*$/m, `enabled: ${enabled}`)
      : `${frontmatter}\nenabled: ${enabled}`;
    const rewritten =
      raw.slice(0, match.index!) +
      open +
      rewrittenFrontmatter +
      close +
      raw.slice(match.index! + full.length);
    await atomicWriteFile(skillPath, matchEol(rewritten, raw));
  });
}
