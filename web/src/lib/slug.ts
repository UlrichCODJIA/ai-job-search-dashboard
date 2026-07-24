/** Normalizes a company name into a stable key so /apply, /interview, and
 * /outcome runs on the same company can share a resumable session. */
export function companySlug(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
