import type { ProfileData } from "../api/types";

export function buildSetupHint(
  profile: ProfileData | undefined,
  documents: Record<string, string[]> | undefined,
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

  return parts.length > 0 ? parts.join(" ") : undefined;
}
