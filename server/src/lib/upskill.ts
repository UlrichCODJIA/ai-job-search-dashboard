import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { extractSection, parseMarkdownTableRows } from "./markdown.js";
import { paths } from "./paths.js";

export interface GapHeatmapRow {
  priority: string;
  skill: string;
  type: string;
  gapSource: string;
}

export interface StudyOrderRow {
  order: string;
  topic: string;
  type: string;
  estTime: string;
  note: string;
}

export interface UpskillReport {
  filename: string;
  date: string;
  mode: string;
  sinceLastReport: string | null;
  gapHeatmap: GapHeatmapRow[];
  learningPlanRaw: string;
  suggestedStudyOrder: StudyOrderRow[];
  totalEstimatedTime: string | null;
}

export function parseUpskillReport(filename: string, rawText: string): UpskillReport {
  // Normalize CRLF first: JS regex `.` never matches `\r`, so an un-normalized
  // trailing `\r` on each line silently breaks these `$`-anchored matches.
  const text = rawText.replace(/\r\n/g, "\n");
  const titleMatch = text.match(/^#\s*Upskill Report\s*[—-]\s*(.+)$/m);
  const modeMatch = text.match(/^\*\*Mode:?\*\*\s*(.+)$/m);

  const heatmapSection = extractSection(text, "Gap Heatmap");
  const gapHeatmap: GapHeatmapRow[] = heatmapSection
    ? parseMarkdownTableRows(heatmapSection).map(([priority, skill, type, gapSource]) => ({
        priority: priority ?? "",
        skill: skill ?? "",
        type: type ?? "",
        gapSource: gapSource ?? "",
      }))
    : [];

  const studySection = extractSection(text, "Suggested Study Order");
  const suggestedStudyOrder: StudyOrderRow[] = studySection
    ? parseMarkdownTableRows(studySection).map(([order, topic, type, estTime, note]) => ({
        order: order ?? "",
        topic: topic ?? "",
        type: type ?? "",
        estTime: estTime ?? "",
        note: note ?? "",
      }))
    : [];

  const totalMatch = text.match(/\*\*Total estimated time:\s*([^*]+)\*\*/);

  return {
    filename,
    date: titleMatch ? titleMatch[1].trim() : filename,
    mode: modeMatch ? modeMatch[1].trim() : "",
    sinceLastReport: extractSection(text, "Since Last Report"),
    gapHeatmap,
    learningPlanRaw: extractSection(text, "Learning Plan") ?? "",
    suggestedStudyOrder,
    totalEstimatedTime: totalMatch ? totalMatch[1].trim() : null,
  };
}

export async function listUpskillReports(): Promise<UpskillReport[]> {
  if (!existsSync(paths.upskillDir)) return [];
  const entries = await readdir(paths.upskillDir, { withFileTypes: true });
  const filenames = entries
    .filter((e) => e.isFile() && e.name.startsWith("report-") && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort()
    .reverse();

  return Promise.all(
    filenames.map(async (filename) => {
      const text = await readFile(path.join(paths.upskillDir, filename), "utf-8");
      return parseUpskillReport(filename, text);
    }),
  );
}
