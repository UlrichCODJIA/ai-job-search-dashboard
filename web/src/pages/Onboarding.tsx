import { useState } from "react";
import type { FormEvent } from "react";
import { useSaveSetup } from "../api/queries";
import { LogoMark } from "../components/layout/LogoMark";
import { inputClass, primaryButtonClass } from "../lib/ui";

export default function Onboarding() {
  const [repoRoot, setRepoRoot] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const saveSetup = useSaveSetup();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!repoRoot.trim()) return;
    saveSetup.mutate(repoRoot.trim(), {
      onSuccess: (result) => setSavedPath(result.repoRoot),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border/10 bg-surface p-6 shadow-xl sm:p-8">
        <div className="mb-5 flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight text-ink">AI Job Search</span>
        </div>
        <h1 className="mb-1.5 text-xl font-bold tracking-tight text-ink">Let's get set up</h1>
        <p className="mb-5 text-sm text-muted">
          This dashboard reads and launches commands against a separate{" "}
          <code>ai-job-search</code> checkout. Point it at yours to finish setup — keep the two
          in separate directories, never nested inside each other.
        </p>

        {savedPath ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-sm">
            <p className="mb-2 font-medium text-emerald-600 dark:text-emerald-400">Saved.</p>
            <p className="mb-3 text-ink/80">
              Restart the dashboard server once to finish — <code>{savedPath}</code> will be
              picked up automatically from then on.
            </p>
            <pre className="thin-scrollbar overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs text-ink/80">
              bun run start
            </pre>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">ai-job-search checkout path</span>
              <input
                value={repoRoot}
                onChange={(e) => setRepoRoot(e.target.value)}
                placeholder="/path/to/ai-job-search"
                className={inputClass}
                autoFocus
              />
            </label>
            {saveSetup.isError && (
              <p className="text-xs text-red-500">{(saveSetup.error as Error).message}</p>
            )}
            <button
              type="submit"
              disabled={!repoRoot.trim() || saveSetup.isPending}
              className={primaryButtonClass}
            >
              {saveSetup.isPending ? "Checking..." : "Validate & save"}
            </button>
            <p className="text-xs text-muted">
              Prefer an env var instead? Set <code>AI_JOB_SEARCH_ROOT</code> and restart — it
              always takes precedence over this.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
