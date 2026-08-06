import { readCsvFile, writeCsvFileAtomic, type CsvRow } from "./csv.js";
import { withFileLock } from "./fs.js";
import { paths } from "./paths.js";
import { pdfSiblingPath } from "./trackerFiles.js";

const TRACKER_HEADER = [
  "date",
  "company",
  "sector",
  "role",
  "role_type",
  "channel",
  "status",
  "contact_person",
  "fit_rating",
  "notes",
  "cv_file",
  "cover_letter_file",
  "source",
  "next_interview_date",
] as const;

export type StatusBucket =
  | "Drafted"
  | "Active"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected/Closed";

const STATUS_BUCKETS: Record<string, StatusBucket> = {
  drafted: "Drafted",
  applied: "Active",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected/Closed",
  no_response: "Rejected/Closed",
  "no response": "Rejected/Closed",
  offer_declined: "Rejected/Closed",
  interview_only: "Rejected/Closed",
  withdrawn: "Rejected/Closed",
};

export function bucketForStatus(status: string): StatusBucket {
  return STATUS_BUCKETS[status.trim().toLowerCase()] ?? "Active";
}

export interface TrackerRow extends CsvRow {
  id: string;
  bucket: StatusBucket;
  cv_file_pdf: string;
  cover_letter_file_pdf: string;
}

function rowId(row: CsvRow, index: number): string {
  const raw = `${row.date ?? ""}|${row.company ?? ""}|${row.role ?? ""}|${index}`;
  return Buffer.from(raw, "utf-8").toString("base64url");
}

function withPdfSiblings(
  row: CsvRow & { id: string; bucket: StatusBucket },
): TrackerRow {
  return {
    ...row,
    cv_file_pdf: (row.cv_file && pdfSiblingPath(row.cv_file)) || "",
    cover_letter_file_pdf:
      (row.cover_letter_file && pdfSiblingPath(row.cover_letter_file)) || "",
  };
}

export async function listTrackerRows(): Promise<TrackerRow[]> {
  const { rows } = await readCsvFile(paths.tracker);
  return rows.map((row, index) =>
    withPdfSiblings({
      ...row,
      id: rowId(row, index),
      bucket: bucketForStatus(row.status ?? ""),
    }),
  );
}

export class TrackerRowConflictError extends Error {
  constructor(
    public readonly field: "status" | "notes",
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(
      `This row's ${field} changed since you opened it (was "${expected}", is now "${actual}"). Reload and try again.`,
    );
    this.name = "TrackerRowConflictError";
  }
}

export async function updateTrackerRow(
  id: string,
  expected: Partial<Pick<CsvRow, "status" | "notes">>,
  patch: Partial<Pick<CsvRow, "status" | "notes">>,
): Promise<TrackerRow | null> {
  return withFileLock(paths.tracker, async () => {
    const { header, rows } = await readCsvFile(paths.tracker);
    const activeHeader = header.length > 0 ? header : [...TRACKER_HEADER];

    const index = rows.findIndex((row, i) => rowId(row, i) === id);
    if (index === -1) return null;
    const current = rows[index];

    for (const field of ["status", "notes"] as const) {
      if (!(field in expected)) continue;
      const currentValue = current[field] ?? "";
      const expectedValue = expected[field] ?? "";
      if (currentValue !== expectedValue) {
        throw new TrackerRowConflictError(field, expectedValue, currentValue);
      }
    }

    const matched = { ...current, ...patch };
    const nextRows = rows.map((row, i) => (i === index ? matched : row));
    await writeCsvFileAtomic(paths.tracker, activeHeader, nextRows);
    return withPdfSiblings({
      ...matched,
      id,
      bucket: bucketForStatus(matched.status ?? ""),
    });
  });
}
