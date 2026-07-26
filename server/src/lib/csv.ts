import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "./fs.js";

export type CsvRow = Record<string, string>;

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function rowsToRecords(allRows: string[][]): {
  header: string[];
  rows: CsvRow[];
} {
  const header = allRows[0] ?? [];
  const rows = allRows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells) => {
      const row: CsvRow = {};
      header.forEach((key, i) => {
        row[key] = cells[i] ?? "";
      });
      return row;
    });
  return { header, rows };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function stringifyCsv(header: string[], rows: CsvRow[]): string {
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

export async function readCsvFile(
  filePath: string,
): Promise<{ header: string[]; rows: CsvRow[] }> {
  if (!existsSync(filePath)) return { header: [], rows: [] };
  const text = await readFile(filePath, "utf-8");
  return rowsToRecords(parseCsvRows(text));
}

export async function writeCsvFileAtomic(
  filePath: string,
  header: string[],
  rows: CsvRow[],
): Promise<void> {
  await atomicWriteFile(filePath, stringifyCsv(header, rows));
}
