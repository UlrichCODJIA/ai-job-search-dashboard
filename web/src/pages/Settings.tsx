import { useEffect, useState } from "react";
import {
  usePortalSkills,
  useSearchQueries,
  useSettings,
  useUpdateSearchQueries,
  useUpdateSettings,
} from "../api/queries";
import { PageHeader } from "../components/layout/PageHeader";
import { QueryState } from "../components/QueryState";
import { primaryButtonClass } from "../lib/ui";

const textareaClass =
  "w-full rounded-2xl border border-border/15 bg-surface px-3.5 py-2.5 font-mono text-xs leading-relaxed text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";
const inputClass =
  "w-full rounded-full border border-border/15 bg-surface px-3.5 py-1.5 font-mono text-xs text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";

const unreachableFallback = (
  <p className="text-sm text-red-500">Couldn't reach the dashboard server. Make sure it's running.</p>
);

function SearchQueriesEditor() {
  const queriesQuery = useSearchQueries();
  const updateQueries = useUpdateSearchQueries();
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (queriesQuery.data && draft === null) setDraft(queriesQuery.data.content);
  }, [queriesQuery.data, draft]);

  return (
    <QueryState
      query={{ isLoading: draft === null, isError: queriesQuery.isError }}
      errorFallback={unreachableFallback}
    >
      {() => {
        const value = draft as string;
        const isDirty = value !== queriesQuery.data?.content;

        return (
          <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-ink">Search queries</h2>
                <p className="text-xs text-muted">
                  Drives what <code>/scrape</code> searches for. Edits here save straight to{" "}
                  <code>.claude/skills/job-scraper/search-queries.md</code>.
                </p>
              </div>
              <button
                onClick={() => updateQueries.mutate(value)}
                disabled={!isDirty || updateQueries.isPending}
                className={primaryButtonClass}
              >
                {updateQueries.isPending ? "Saving..." : "Save"}
              </button>
            </div>
            {updateQueries.isError && (
              <p className="mb-2 text-xs text-red-500">{(updateQueries.error as Error).message}</p>
            )}
            {updateQueries.isSuccess && !isDirty && <p className="mb-2 text-xs text-emerald-500">Saved.</p>}
            <textarea
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              rows={22}
              className={textareaClass}
              spellCheck={false}
            />
          </section>
        );
      }}
    </QueryState>
  );
}

function PermissionsEditor() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [allow, setAllow] = useState<string[] | null>(null);

  useEffect(() => {
    if (settingsQuery.data && allow === null) setAllow(settingsQuery.data.allow);
  }, [settingsQuery.data, allow]);

  return (
    <QueryState
      query={{ isLoading: allow === null, isError: settingsQuery.isError }}
      errorFallback={unreachableFallback}
    >
      {() => {
        const patterns = allow as string[];
        const isDirty = JSON.stringify(patterns) !== JSON.stringify(settingsQuery.data?.allow ?? []);

        const setPattern = (i: number, value: string) =>
          setAllow((prev) => prev!.map((p, idx) => (idx === i ? value : p)));
        const removePattern = (i: number) => setAllow((prev) => prev!.filter((_, idx) => idx !== i));
        const addPattern = () => setAllow((prev) => [...prev!, ""]);

        return (
          <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-ink">Auto-approved commands</h2>
                <p className="text-xs text-muted">
                  Tool patterns here run without an approval prompt. Only add commands you trust. Saves to{" "}
                  <code>.claude/settings.json</code>.
                </p>
              </div>
              <button
                onClick={() => updateSettings.mutate(patterns.filter((p) => p.trim()))}
                disabled={!isDirty || updateSettings.isPending}
                className={primaryButtonClass}
              >
                {updateSettings.isPending ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                Advanced, and a little dangerous. A pattern here lets Claude Code run that exact command
                against your machine with no approval step, every time, in every run. Only add a pattern if
                you understand exactly what it lets run and you trust it unconditionally. When unsure, leave
                it out. Denied commands just show an approval prompt instead, they still work fine.
              </p>
            </div>
            {updateSettings.isError && (
              <p className="mb-2 text-xs text-red-500">{(updateSettings.error as Error).message}</p>
            )}
            {updateSettings.isSuccess && !isDirty && <p className="mb-2 text-xs text-emerald-500">Saved.</p>}
            <div className="flex flex-col gap-2">
              {patterns.map((pattern, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={pattern}
                    onChange={(e) => setPattern(i, e.target.value)}
                    placeholder='e.g. Bash(npm run:*)'
                    className={inputClass}
                  />
                  <button
                    onClick={() => removePattern(i)}
                    aria-label="Remove pattern"
                    className="shrink-0 rounded-full border border-border/15 px-2.5 py-1 text-xs text-muted transition-colors hover:border-red-500/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addPattern}
                className="self-start rounded-full border border-border/15 px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal"
              >
                + Add pattern
              </button>
            </div>
          </section>
        );
      }}
    </QueryState>
  );
}

function InstalledPortals() {
  const portalsQuery = usePortalSkills();
  const portals = portalsQuery.data ?? [];

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-bold tracking-tight text-ink">Installed portals</h2>
      <p className="mb-3 text-xs text-muted">
        Job-board search skills <code>/scrape</code> runs. Add more with <code>/add-portal</code> from Runs.
      </p>
      <QueryState query={portalsQuery} errorFallback={unreachableFallback}>
        {() =>
          portals.length === 0 ? (
            <p className="text-xs text-muted">No portal skills found under <code>.agents/skills/</code>.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {portals.map((portal) => (
                <li
                  key={portal.name}
                  className="flex items-start gap-2.5 rounded-2xl border border-border/10 px-3 py-2"
                >
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${portal.enabled ? "bg-signal" : "bg-muted"}`}
                    title={portal.enabled ? "Enabled" : "Disabled"}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {portal.name}
                      {!portal.enabled && <span className="ml-2 text-xs font-normal text-muted">disabled</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{portal.descriptionPreview}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        subtitle="Configure how Claude Code searches and acts on your behalf, no file editor needed."
      />
      <SearchQueriesEditor />
      <PermissionsEditor />
      <InstalledPortals />
    </div>
  );
}
