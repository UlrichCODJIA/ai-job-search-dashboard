import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDismissJob, useJobs, useLaunchRun } from "../api/queries";
import type { ScrapedJob } from "../api/types";
import { Avatar } from "../components/Avatar";
import { Donut } from "../components/charts/Donut";
import { type Column, DataTable } from "../components/DataTable";
import { Drawer } from "../components/Drawer";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { FIT_COLORS, FitPill, NeutralPill } from "../components/Pill";
import { QueryState } from "../components/QueryState";
import { StatCard } from "../components/StatCard";
import { resolveFitBucket } from "../lib/fit";
import { companySlug } from "../lib/slug";
import { inputClass } from "../lib/ui";

const STATUS_OPTIONS = ["all", "new", "ranked", "evaluated", "skipped", "expired"];
const FIT_OPTIONS = ["all", "high", "medium", "low"];
const FIT_BUCKET_RANK: Record<"high" | "medium" | "low", number> = { high: 3, medium: 2, low: 1 };

export default function Discovery() {
  const jobsQuery = useJobs();
  const dismissJob = useDismissJob();
  const launchRun = useLaunchRun();
  const navigate = useNavigate();
  const [status, setStatus] = useState("all");
  const [fit, setFit] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ScrapedJob | null>(null);

  const jobs = jobsQuery.data ?? [];
  const newCount = jobs.filter((j) => j.status === "new").length;
  const fitCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const job of jobs) counts[resolveFitBucket(job)]++;
    return counts;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (status !== "all" && job.status !== status) return false;
      if (fit !== "all" && resolveFitBucket(job) !== fit) return false;
      if (q && !`${job.title} ${job.company}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, status, fit, search]);

  const handleApply = (job: ScrapedJob) => {
    launchRun.mutate(
      { command: "/apply", args: job.url, resumeKey: companySlug(job.company) },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  const handleRankAll = () => {
    launchRun.mutate({ command: "/rank" }, { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) });
  };

  const columns: Column<ScrapedJob>[] = [
    {
      key: "fit",
      header: "Fit",
      render: (job) => <FitPill fit={job.rank_verdict ?? job.fit} />,
      sortValue: (job) => FIT_BUCKET_RANK[resolveFitBucket(job)],
    },
    {
      key: "title",
      header: "Title",
      render: (job) => (
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink hover:text-signal hover:underline"
        >
          {job.title}
        </a>
      ),
      sortValue: (job) => job.title,
    },
    {
      key: "company",
      header: "Company",
      render: (job) => (
        <span className="flex items-center gap-2">
          <Avatar name={job.company} size={22} />
          {job.company}
        </span>
      ),
      sortValue: (job) => job.company,
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <NeutralPill>{job.status}</NeutralPill>,
      sortValue: (job) => job.status,
    },
    {
      key: "first_seen",
      header: "First seen",
      render: (job) => job.first_seen,
      sortValue: (job) => job.first_seen,
    },
    {
      key: "actions",
      header: "",
      render: (job) => (
        <div className="flex items-center justify-end gap-2">
          {Boolean(job.rank_strengths?.length || job.rank_gaps?.length) && (
            <button
              onClick={() => setSelected(job)}
              className="rounded-full border border-border/15 px-2.5 py-1 text-xs font-medium text-muted transition-transform hover:border-signal/30 hover:text-signal active:scale-[0.97]"
            >
              Why?
            </button>
          )}
          {job.status !== "expired" && (
            <button
              onClick={() => handleApply(job)}
              disabled={launchRun.isPending}
              className="rounded-full border border-border/15 px-2.5 py-1 text-xs font-medium text-muted transition-transform hover:border-signal/30 hover:text-signal active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              Apply
            </button>
          )}
          {job.status !== "skipped" && job.status !== "expired" && (
            <button
              onClick={() => dismissJob.mutate(job.key)}
              disabled={dismissJob.isPending}
              className="rounded-full border border-border/15 px-2.5 py-1 text-xs font-medium text-muted transition-transform hover:border-red-500/30 hover:text-red-400 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
            >
              Dismiss
            </button>
          )}
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <QueryState query={jobsQuery}>
      {() => (
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Discovery"
            subtitle={`${jobs.length} postings seen by /scrape and /rank.`}
            action={
              newCount > 0 && (
                <button
                  onClick={handleRankAll}
                  disabled={launchRun.isPending}
                  className="rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                >
                  Rank {newCount} new job{newCount === 1 ? "" : "s"}
                </button>
              )
            }
          />

          {jobs.length === 0 ? (
            <EmptyState
              title="No postings scraped yet"
              description="Run /scrape from Claude Code to search job portals for matches. They'll show up here."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <section className="col-span-2 flex flex-col rounded-3xl border border-border/10 bg-surface p-4 shadow-sm lg:col-span-1">
                  <h2 className="mb-3 text-sm font-bold tracking-tight text-ink">Fit distribution</h2>
                  <div className="flex flex-1 items-center gap-4">
                    <Donut
                      size={104}
                      thickness={18}
                      segments={[
                        { label: "High", value: fitCounts.high, color: FIT_COLORS.high },
                        { label: "Medium", value: fitCounts.medium, color: FIT_COLORS.medium },
                        { label: "Low", value: fitCounts.low, color: FIT_COLORS.low },
                      ]}
                    />
                    <ul className="flex flex-1 flex-col gap-1.5 text-xs">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FIT_COLORS.high }} />
                        <span className="text-muted">High</span>
                        <span className="ml-auto font-bold text-ink">{fitCounts.high}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FIT_COLORS.medium }} />
                        <span className="text-muted">Medium</span>
                        <span className="ml-auto font-bold text-ink">{fitCounts.medium}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FIT_COLORS.low }} />
                        <span className="text-muted">Low</span>
                        <span className="ml-auto font-bold text-ink">{fitCounts.low}</span>
                      </li>
                    </ul>
                  </div>
                </section>
                <StatCard label="Total postings" value={jobs.length} accent={FIT_COLORS.medium} />
                <StatCard label="High fit" value={fitCounts.high} hint="strong matches" accent={FIT_COLORS.high} />
                <StatCard label="Awaiting rank" value={newCount} hint="new since last /rank" accent="#f59e0b" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or company..."
                  className={`w-64 ${inputClass}`}
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "All statuses" : s}
                    </option>
                  ))}
                </select>
                <select value={fit} onChange={(e) => setFit(e.target.value)} className={inputClass}>
                  {FIT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f === "all" ? "All fit levels" : f}
                    </option>
                  ))}
                </select>
              </div>
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(job) => job.key}
                emptyMessage="No postings match these filters."
              />
            </>
          )}

          <Drawer
            open={selected !== null}
            onOpenChange={(open) => !open && setSelected(null)}
            title={selected ? `${selected.title} at ${selected.company}` : ""}
          >
            {selected && (
              <div className="flex flex-col gap-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <FitPill fit={selected.rank_verdict ?? selected.fit} />
                  {selected.rank_deadline && (
                    <NeutralPill>Deadline: {selected.rank_deadline}</NeutralPill>
                  )}
                  {selected.rank_location === "FAIL" && (
                    <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-500">
                      Location: excluded
                    </span>
                  )}
                  {selected.rank_location === "FLAG" && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-500">
                      ⚠ Location flagged
                    </span>
                  )}
                </div>
                {selected.rank_strengths && selected.rank_strengths.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Strengths
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {selected.rank_strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span className="text-ink/80">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.rank_gaps && selected.rank_gaps.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Gaps</h3>
                    <ul className="flex flex-col gap-1.5">
                      {selected.rank_gaps.map((g, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span className="text-ink/80">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.rank_date && (
                  <p className="text-xs text-muted">
                    Triage score from posting text only, ranked {selected.rank_date}. Running{" "}
                    <code>/apply</code> re-evaluates with company research before anything is drafted.
                  </p>
                )}
              </div>
            )}
          </Drawer>
        </div>
      )}
    </QueryState>
  );
}
