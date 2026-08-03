import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";

export type TemplateType = "cv" | "cover_letters";

export interface RegisteredTemplate {
  name: string;
  type: TemplateType;
  engine: string;
  pageLimit: string;
  fonts: string;
  active: boolean;
}

function extractManifestField(text: string, label: string): string {
  const re = new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, "m");
  return text.match(re)?.[1]?.trim() ?? "";
}

async function activeTemplateName(guidancePath: string): Promise<string | null> {
  if (!existsSync(guidancePath)) return null;
  const text = await readFile(guidancePath, "utf-8");
  return text.match(/Active template override:\s*`([^`]+)`/)?.[1]?.trim() ?? null;
}

async function listForType(
  type: TemplateType,
  guidancePath: string,
): Promise<RegisteredTemplate[]> {
  const dir = path.join(paths.templatesDir, type);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const activeName = await activeTemplateName(guidancePath);

  const templates = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e): Promise<RegisteredTemplate | null> => {
        const manifestPath = path.join(dir, e.name, "TEMPLATE.md");
        let text: string;
        try {
          text = await readFile(manifestPath, "utf-8");
        } catch {
          return null;
        }
        return {
          name: e.name,
          type,
          engine: extractManifestField(text, "Engine"),
          pageLimit: extractManifestField(text, "Page limit"),
          fonts: extractManifestField(text, "Fonts"),
          active: activeName === e.name,
        };
      }),
  );

  return templates.filter((t): t is RegisteredTemplate => t !== null);
}

export async function listRegisteredTemplates(): Promise<RegisteredTemplate[]> {
  const [cvTemplates, coverLetterTemplates] = await Promise.all([
    listForType("cv", paths.cvTemplatesGuidance),
    listForType("cover_letters", paths.coverLetterTemplatesGuidance),
  ]);
  return [...cvTemplates, ...coverLetterTemplates].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
