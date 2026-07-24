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

export type StatusBucket = "Active" | "Interview" | "Offer" | "Hired" | "Rejected/Closed";

// Mirrors the status normalisation in .claude/commands/html-report.md Step 1.
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

// Rows have no natural primary key, so derive one from position + content. If the file
// changes between a GET and a PATCH, the id may no longer resolve -- updateTrackerRow
// returns null in that case rather than risking a wrong-row edit.
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

// Only status/notes are accepted: status is the one column /outcome itself
// updates after row creation, and notes is the one column it appends to.
// Every other column is set once when the row is created and read-only here,
// same as the rest of ai-job-search's own design (see dashboard/README.md).
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
