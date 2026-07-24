import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { atomicWriteFile, withFileLock } from "./fs.js";
import { paths, REPO_ROOT } from "./paths.js";

export interface SalaryStatus {
  available: boolean;
  metadata?: Record<string, unknown>;
  companyCount?: number;
}

export interface SalaryCategory {
  count?: number;
  index?: number;
}

export interface SalaryCompanyEntry {
  company: string;
  city?: string;
  categories?: Record<string, SalaryCategory>;
}

export interface SalaryMetadata {
  source?: string;
  index_baseline?: number;
  index_label?: string;
  baseline_description?: string;
}

export interface SalaryData {
  metadata: SalaryMetadata;
  companies: SalaryCompanyEntry[];
}

const DEFAULT_METADATA: SalaryMetadata = {
  source: "",
  index_baseline: 0,
  index_label: "Index",
  baseline_description: "",
};

function parseSalaryJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`invalid JSON in salary_data.json: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getSalaryStatus(): Promise<SalaryStatus> {
  if (!existsSync(paths.salaryData)) return { available: false };
  const text = await readFile(paths.salaryData, "utf-8");
  const data = parseSalaryJson<{
    metadata?: Record<string, unknown>;
    companies?: unknown[];
  }>(text);
  return {
    available: true,
    metadata: data.metadata,
    companyCount: Array.isArray(data.companies) ? data.companies.length : 0,
  };
}

function resolvePython(): string {
  return process.platform === "win32" ? "python" : "python3";
}

/** Shells to the existing salary_lookup.py --json rather than re-implementing its
 * index/baseline math (tools/README_SALARY_TOOL.md documents that math and it can change). */
export async function searchSalary(query: string): Promise<unknown> {
  if (!existsSync(paths.salaryData)) {
    throw new Error("salary_data.json not found");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(resolvePython(), [paths.salaryLookupScript, query, "--json"], {
      cwd: REPO_ROOT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        // salary_lookup.py's main() exits 1 with a "No results found" message printed
        // to stdout (not stderr) for a genuine zero-match search -- that's not a
        // failure. Only treat it as one when stderr actually has content, or the
        // exit code is something other than this specific expected case.
        if (code === 1 && !stderr.trim()) {
          resolve([]);
          return;
        }
        reject(new Error(stderr.trim() || `salary_lookup.py exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("salary_lookup.py returned non-JSON output"));
      }
    });
  });
}

async function readSalaryData(): Promise<SalaryData> {
  if (!existsSync(paths.salaryData)) {
    return { metadata: { ...DEFAULT_METADATA }, companies: [] };
  }
  const text = await readFile(paths.salaryData, "utf-8");
  const data = parseSalaryJson<Partial<SalaryData>>(text);
  return {
    metadata: { ...DEFAULT_METADATA, ...(data.metadata ?? {}) },
    companies: Array.isArray(data.companies) ? data.companies : [],
  };
}

async function writeSalaryData(data: SalaryData): Promise<void> {
  await atomicWriteFile(paths.salaryData, `${JSON.stringify(data, null, 2)}\n`);
}

export async function getSalaryData(): Promise<SalaryData> {
  return readSalaryData();
}

/** Index of the company matching `name` case-insensitively, or -1. Exported
 * standalone (no FS) so the rename/duplicate logic is unit-testable. */
export function findCompanyIndex(companies: SalaryCompanyEntry[], name: string): number {
  const needle = name.trim().toLowerCase();
  return companies.findIndex((c) => c.company.trim().toLowerCase() === needle);
}

export function assertValidCompanyEntry(entry: SalaryCompanyEntry): void {
  if (!entry.company || !entry.company.trim()) {
    throw new Error("Company name is required.");
  }
  if (entry.categories) {
    for (const [label, cat] of Object.entries(entry.categories)) {
      if (!label.trim()) throw new Error("Category name cannot be empty.");
      if (cat.count != null && typeof cat.count !== "number") {
        throw new Error(`Category "${label}": count must be a number.`);
      }
      if (cat.index != null && typeof cat.index !== "number") {
        throw new Error(`Category "${label}": index must be a number.`);
      }
    }
  }
}

/** Creates a new company, or updates the one matching `originalName` (renames included). */
export async function upsertSalaryCompany(
  entry: SalaryCompanyEntry,
  originalName?: string,
): Promise<SalaryData> {
  assertValidCompanyEntry(entry);
  return withFileLock(paths.salaryData, async () => {
    const data = await readSalaryData();
    const targetIndex = originalName ? findCompanyIndex(data.companies, originalName) : -1;

    const collisionIndex = findCompanyIndex(data.companies, entry.company);
    if (collisionIndex >= 0 && collisionIndex !== targetIndex) {
      throw new Error(`A company named "${entry.company}" already exists.`);
    }

    if (targetIndex >= 0) {
      data.companies[targetIndex] = entry;
    } else {
      data.companies.push(entry);
    }
    await writeSalaryData(data);
    return data;
  });
}

export async function deleteSalaryCompany(company: string): Promise<SalaryData> {
  return withFileLock(paths.salaryData, async () => {
    const data = await readSalaryData();
    const index = findCompanyIndex(data.companies, company);
    if (index < 0) throw new Error(`No company named "${company}" found.`);
    data.companies.splice(index, 1);
    await writeSalaryData(data);
    return data;
  });
}

export async function updateSalaryMetadata(metadata: SalaryMetadata): Promise<SalaryData> {
  return withFileLock(paths.salaryData, async () => {
    const data = await readSalaryData();
    data.metadata = { ...data.metadata, ...metadata };
    await writeSalaryData(data);
    return data;
  });
}
