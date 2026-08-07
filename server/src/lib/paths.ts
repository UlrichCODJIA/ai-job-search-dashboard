import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { readDashboardConfig } from "./dashboardConfig.js";

export function looksLikeAiJobSearchCheckout(dir: string): boolean {
  return (
    existsSync(path.join(dir, "CLAUDE.md")) &&
    existsSync(path.join(dir, ".claude"))
  );
}

function resolveRepoRoot(): string | null {
  const override = process.env.AI_JOB_SEARCH_ROOT;
  if (override) {
    const resolved = path.resolve(override);
    if (!looksLikeAiJobSearchCheckout(resolved)) {
      throw new Error(
        `AI_JOB_SEARCH_ROOT is set to "${resolved}", but it doesn't look like an ai-job-search ` +
          `checkout (expected to find CLAUDE.md and .claude/ there).`,
      );
    }
    return resolved;
  }
  const saved = readDashboardConfig()?.repoRoot;
  if (saved) {
    const resolved = path.resolve(saved);
    if (looksLikeAiJobSearchCheckout(resolved)) return resolved;
  }
  return null;
}

const REPO_ROOT_VALUE: string | null = resolveRepoRoot();

/** @deprecated prefer `isConfigured()` / `paths.repoRoot` -- kept for existing consumers. */
export const REPO_ROOT = REPO_ROOT_VALUE;

export function isConfigured(): boolean {
  return REPO_ROOT_VALUE !== null;
}

export class RootNotConfiguredError extends Error {
  constructor() {
    super(
      "The dashboard isn't configured yet. Set AI_JOB_SEARCH_ROOT and restart, or finish " +
        "setup from the onboarding screen.",
    );
    this.name = "RootNotConfiguredError";
  }
}

function requireRepoRoot(): string {
  if (REPO_ROOT_VALUE === null) throw new RootNotConfiguredError();
  return REPO_ROOT_VALUE;
}

const DASHBOARD_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

let cachedRepoRootHash: string | null = null;
function repoRootHash(): string {
  cachedRepoRootHash ??= createHash("sha256")
    .update(requireRepoRoot())
    .digest("hex")
    .slice(0, 16);
  return cachedRepoRootHash;
}

export const paths = {
  get repoRoot() {
    return requireRepoRoot();
  },
  get claudeMd() {
    return path.join(requireRepoRoot(), "CLAUDE.md");
  },
  get seenJobs() {
    return path.join(requireRepoRoot(), "job_scraper", "seen_jobs.json");
  },
  get portalHealth() {
    return path.join(requireRepoRoot(), "job_scraper", "portal_health.json");
  },
  get tracker() {
    return path.join(requireRepoRoot(), "job_search_tracker.csv");
  },
  get templatesDir() {
    return path.join(requireRepoRoot(), "templates");
  },
  get cvTemplatesGuidance() {
    return path.join(
      requireRepoRoot(),
      ".claude",
      "skills",
      "job-application-assistant",
      "05-cv-templates.md",
    );
  },
  get coverLetterTemplatesGuidance() {
    return path.join(
      requireRepoRoot(),
      ".claude",
      "skills",
      "job-application-assistant",
      "06-cover-letter-templates.md",
    );
  },
  get applicationsDir() {
    return path.join(requireRepoRoot(), "documents", "applications");
  },
  get upskillDir() {
    return path.join(requireRepoRoot(), "upskill");
  },
  get salaryData() {
    return path.join(requireRepoRoot(), "salary_data.json");
  },
  get salaryLookupScript() {
    return path.join(requireRepoRoot(), "salary_lookup.py");
  },
  get cvDir() {
    return path.join(requireRepoRoot(), "cv");
  },
  get cvMainExample() {
    return path.join(requireRepoRoot(), "cv", "main_example.tex");
  },
  get coverLettersDir() {
    return path.join(requireRepoRoot(), "cover_letters");
  },
  get profileSkillsDir() {
    return path.join(
      requireRepoRoot(),
      ".claude",
      "skills",
      "job-application-assistant",
    );
  },
  get searchQueries() {
    return path.join(
      requireRepoRoot(),
      ".claude",
      "skills",
      "job-scraper",
      "search-queries.md",
    );
  },
  get claudeSettings() {
    return path.join(requireRepoRoot(), ".claude", "settings.json");
  },
  get agentSkillsDir() {
    return path.join(requireRepoRoot(), ".agents", "skills");
  },
  get reportsDir() {
    return path.join(requireRepoRoot(), "reports");
  },
  // These live under this repo's own install location, not AI_JOB_SEARCH_ROOT --
  // always available, configured or not.
  webDist: path.join(DASHBOARD_ROOT, "web", "dist"),
  runsDir: path.join(DASHBOARD_ROOT, "server", ".runs"),
  runLogsDir: path.join(DASHBOARD_ROOT, "server", ".runs", "logs"),
  uploadsDir: path.join(DASHBOARD_ROOT, "server", ".uploads"),
  get instanceLock() {
    return path.join(DASHBOARD_ROOT, "server", ".runs", `instance-${repoRootHash()}`);
  },
};
