import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";

export interface PortalSkill {
  name: string;
  descriptionPreview: string;
  enabled: boolean;
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
      return {
        name,
        descriptionPreview: extractDescriptionPreview(frontmatter),
        enabled: enabledRaw !== "false",
      };
    }),
  );

  return skills
    .filter((s): s is PortalSkill => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
