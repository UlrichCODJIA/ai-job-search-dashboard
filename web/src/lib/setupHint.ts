import type { ApplicationRecord, ProfileData } from "../api/types";

const RESOLVED_OUTCOMES_HINT_THRESHOLD = 3;

export function buildSetupHint(
  profile: ProfileData | undefined,
  documents: Record<string, string[]> | undefined,
  applications: ApplicationRecord[] | undefined = [],
): string | undefined {
  const parts: string[] = [];

  const foldersWithFiles = documents
    ? Object.entries(documents)
        .filter(([, files]) => files.length > 0)
        .map(([folder]) => folder)
    : [];
  if (foldersWithFiles.length > 0) {
    parts.push(`I have documents in: ${foldersWithFiles.join(", ")}.`);
  }

  if (profile && profile.placeholders.length > 0) {
    const files = [...new Set(profile.placeholders.map((p) => p.file))];
    parts.push(`My profile still has placeholder tokens left in: ${files.join(", ")}.`);
  }

  const resolvedCount = applications.filter(
    (app) => app.outcome && app.outcome.status !== "in_progress",
  ).length;
  if (resolvedCount >= RESOLVED_OUTCOMES_HINT_THRESHOLD) {
    parts.push(
      `I have ${resolvedCount} resolved application outcomes on record - please fold them into the fit framework (Path A).`,
    );
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}
