import { readCsvFile, writeCsvFileAtomic, type CsvRow } from "./csv.js";
import { withFileLock } from "./fs.js";
import { paths } from "./paths.js";

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
] as const;

export type StatusBucket =
  | "Active"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected/Closed";

const STATUS_BUCKETS: Record<string, StatusBucket> = {
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
}

function rowId(row: CsvRow, index: number): string {
  const raw = `${row.date ?? ""}|${row.company ?? ""}|${row.role ?? ""}|${index}`;
  return Buffer.from(raw, "utf-8").toString("base64url");
}

export async function listTrackerRows(): Promise<TrackerRow[]> {
  const { rows } = await readCsvFile(paths.tracker);
  return rows.map((row, index) => ({
    ...row,
    id: rowId(row, index),
    bucket: bucketForStatus(row.status ?? ""),
  }));
}

export async function updateTrackerRow(
  id: string,
  patch: Partial<Pick<CsvRow, "status" | "notes">>,
): Promise<TrackerRow | null> {
  return withFileLock(paths.tracker, async () => {
    const { header, rows } = await readCsvFile(paths.tracker);
    const activeHeader = header.length > 0 ? header : [...TRACKER_HEADER];

    let matched: CsvRow | null = null;
    const nextRows = rows.map((row, index) => {
      if (rowId(row, index) !== id) return row;
      matched = { ...row, ...patch };
      return matched;
    });

    if (!matched) return null;
    await writeCsvFileAtomic(paths.tracker, activeHeader, nextRows);
    const finalRow = matched as CsvRow;
    return { ...finalRow, id, bucket: bucketForStatus(finalRow.status ?? "") };
  });
}
