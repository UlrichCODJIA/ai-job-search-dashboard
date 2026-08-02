import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { atomicWriteFile, matchEol, withFileLock } from "./fs.js";
import { paths } from "./paths.js";

export async function getCvTemplate(): Promise<string> {
  if (!existsSync(paths.cvMainExample)) return "";
  return readFile(paths.cvMainExample, "utf-8");
}

export async function updateCvTemplate(content: string): Promise<string> {
  return withFileLock(paths.cvMainExample, async () => {
    const existing = existsSync(paths.cvMainExample)
      ? await readFile(paths.cvMainExample, "utf-8")
      : "";
    const withTrailingNewline = content.endsWith("\n") ? content : `${content}\n`;
    const final = matchEol(withTrailingNewline, existing);
    await atomicWriteFile(paths.cvMainExample, final);
    return final;
  });
}
