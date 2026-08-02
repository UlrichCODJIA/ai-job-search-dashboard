import type { ApplicationRecord } from "../api/types";

function normalizeCompany(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findMatchingApplication(
  applications: ApplicationRecord[],
  trackerCompany: string,
): ApplicationRecord | null {
  const normalizedCompany = normalizeCompany(trackerCompany);
  if (normalizedCompany.length === 0) return null;

  const exactMatch = applications.find(
    (app) => normalizeCompany(app.companySlug) === normalizedCompany,
  );
  if (exactMatch) return exactMatch;

  const substringMatches = applications.filter((app) => {
    const slug = normalizeCompany(app.companySlug);
    return (
      slug.length > 0 &&
      (slug.includes(normalizedCompany) || normalizedCompany.includes(slug))
    );
  });
  return substringMatches.length === 1 ? substringMatches[0] : null;
}
