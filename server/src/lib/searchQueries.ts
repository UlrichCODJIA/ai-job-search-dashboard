import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { atomicWriteFile, matchEol, withFileLock } from "./fs.js";
import { paths } from "./paths.js";

export async function getSearchQueries(): Promise<string> {
  if (!existsSync(paths.searchQueries)) return "";
  return readFile(paths.searchQueries, "utf-8");
}

export async function updateSearchQueries(content: string): Promise<string> {
  return withFileLock(paths.searchQueries, async () => {
    const existing = existsSync(paths.searchQueries) ? await readFile(paths.searchQueries, "utf-8") : "";
    const withTrailingNewline = content.endsWith("\n") ? content : `${content}\n`;
    const final = matchEol(withTrailingNewline, existing);
    await atomicWriteFile(paths.searchQueries, final);
    return final;
  });
}
