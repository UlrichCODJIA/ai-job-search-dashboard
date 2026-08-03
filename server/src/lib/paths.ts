import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

function looksLikeAiJobSearchCheckout(dir: string): boolean {
  return (
    existsSync(path.join(dir, "CLAUDE.md")) &&
    existsSync(path.join(dir, ".claude"))
  );
}

function findRepoRoot(): string {
  const override = process.env.AI_JOB_SEARCH_ROOT;
  if (!override) {
    throw new Error(
      "AI_JOB_SEARCH_ROOT is not set. Point it at your ai-job-search checkout, " +
        "e.g. AI_JOB_SEARCH_ROOT=/path/to/ai-job-search bun run dev",
    );
  }
  const resolved = path.resolve(override);
  if (looksLikeAiJobSearchCheckout(resolved)) return resolved;
  throw new Error(
    `AI_JOB_SEARCH_ROOT is set to "${resolved}", but it doesn't look like an ai-job-search ` +
      `checkout (expected to find CLAUDE.md and .claude/ there).`,
  );
}

export const REPO_ROOT = findRepoRoot();

const DASHBOARD_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

const repoRootHash = createHash("sha256")
  .update(REPO_ROOT)
  .digest("hex")
  .slice(0, 16);

export const paths = {
  repoRoot: REPO_ROOT,
  claudeMd: path.join(REPO_ROOT, "CLAUDE.md"),
  seenJobs: path.join(REPO_ROOT, "job_scraper", "seen_jobs.json"),
  portalHealth: path.join(REPO_ROOT, "job_scraper", "portal_health.json"),
  tracker: path.join(REPO_ROOT, "job_search_tracker.csv"),
  templatesDir: path.join(REPO_ROOT, "templates"),
  cvTemplatesGuidance: path.join(
    REPO_ROOT,
    ".claude",
    "skills",
    "job-application-assistant",
    "05-cv-templates.md",
  ),
  coverLetterTemplatesGuidance: path.join(
    REPO_ROOT,
    ".claude",
    "skills",
    "job-application-assistant",
    "06-cover-letter-templates.md",
  ),
  applicationsDir: path.join(REPO_ROOT, "documents", "applications"),
  upskillDir: path.join(REPO_ROOT, "upskill"),
  salaryData: path.join(REPO_ROOT, "salary_data.json"),
  salaryLookupScript: path.join(REPO_ROOT, "salary_lookup.py"),
  cvDir: path.join(REPO_ROOT, "cv"),
  cvMainExample: path.join(REPO_ROOT, "cv", "main_example.tex"),
  coverLettersDir: path.join(REPO_ROOT, "cover_letters"),
  profileSkillsDir: path.join(
    REPO_ROOT,
    ".claude",
    "skills",
    "job-application-assistant",
  ),
  searchQueries: path.join(
    REPO_ROOT,
    ".claude",
    "skills",
    "job-scraper",
    "search-queries.md",
  ),
  claudeSettings: path.join(REPO_ROOT, ".claude", "settings.json"),
  agentSkillsDir: path.join(REPO_ROOT, ".agents", "skills"),
  reportsDir: path.join(REPO_ROOT, "reports"),
  webDist: path.join(DASHBOARD_ROOT, "web", "dist"),
  runsDir: path.join(DASHBOARD_ROOT, "server", ".runs"),
  runLogsDir: path.join(DASHBOARD_ROOT, "server", ".runs", "logs"),
  uploadsDir: path.join(DASHBOARD_ROOT, "server", ".uploads"),
  instanceLock: path.join(
    DASHBOARD_ROOT,
    "server",
    ".runs",
    `instance-${repoRootHash}`,
  ),
} as const;
