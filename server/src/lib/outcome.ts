export interface OutcomeStage {
  label: string;
  checked: boolean;
  date?: string;
}

export interface OutcomeRecord {
  status: string;
  dateResolved?: string;
  stages: OutcomeStage[];
  notes: string;
}

// Parses the exact format /outcome writes (documents/README.md's outcome.md spec):
//   **Status:** in_progress | hired | offer_declined | rejected | no_response | interview_only
//   **Date resolved:** YYYY-MM-DD
//   ## Interview stages reached
//   - [x] Phone screen (YYYY-MM-DD)
//   ## Notes
export function parseOutcomeMarkdown(rawText: string): OutcomeRecord {
  // Normalize CRLF first: JS regex `.` never matches `\r`, so an un-normalized
  // trailing `\r` on each line silently breaks the per-line stage regex below.
  const text = rawText.replace(/\r\n/g, "\n");
  const statusMatch = text.match(/\*\*Status:\*\*\s*(.+)/);
  const dateMatch = text.match(/\*\*Date resolved:\*\*\s*(.+)/);
  const stagesMatch = text.match(/## Interview stages reached\n([\s\S]*?)(?=\n## |$)/);
  const notesMatch = text.match(/## Notes\n([\s\S]*)$/);

  const stages: OutcomeStage[] = [];
  if (stagesMatch) {
    for (const line of stagesMatch[1].split("\n")) {
      const item = line.match(/^-\s*\[( |x|X)\]\s*(.+)$/);
      if (!item) continue;
      const rest = item[2].trim();
      const withDate = rest.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      stages.push({
        label: (withDate ? withDate[1] : rest).trim(),
        checked: item[1].toLowerCase() === "x",
        date: withDate?.[2],
      });
    }
  }

  return {
    status: statusMatch ? statusMatch[1].trim() : "in_progress",
    dateResolved: dateMatch?.[1]?.trim(),
    stages,
    notes: notesMatch ? notesMatch[1].trim() : "",
  };
}
