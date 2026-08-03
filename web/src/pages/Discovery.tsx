import clsx from "clsx";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDismissJob, useJobs, useLaunchRun } from "../api/queries";
import type { ScrapedJob } from "../api/types";
import { Avatar } from "../components/Avatar";
import { Donut } from "../components/charts/Donut";
import { Legend } from "../components/charts/Legend";
import { type Column, DataTable } from "../components/DataTable";
import { Drawer } from "../components/Drawer";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionHeading } from "../components/layout/SectionHeading";
import { FIT_COLORS, FitPill, NeutralPill } from "../components/Pill";
import { QueryState } from "../components/QueryState";
import { StatCard } from "../components/StatCard";
import { isPastDeadline, isUrgentDeadline, resolveEffectiveDeadline } from "../lib/deadline";
import { isLocationExcluded, rankSortPriority, resolveDisplayBucket } from "../lib/fit";
import { daysAgoLabel, daysSince, isStaleNewJob } from "../lib/pipeline";
import { companySlug } from "../lib/slug";
import { inputClass, primaryButtonClass } from "../lib/ui";

const STATUS_OPTIONS = ["all", "new", "ranked", "evaluated", "skipped", "expired"];
const FIT_OPTIONS = ["all", "high", "medium", "low", "excluded"];
const FIT_BUCKET_RANK: Record<"high" | "medium" | "low" | "excluded", number> = {
  high: 3,
  medium: 2,
  low: 1,
  excluded: 0,
};

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
  const closingSoonCount = useMemo(
    () =>
      jobs.filter((j) => !isLocationExcluded(j) && isUrgentDeadline(resolveEffectiveDeadline(j)))
        .length,
    [jobs],
  );
  const fitCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0, excluded: 0 };
    for (const job of jobs) counts[resolveDisplayBucket(job)]++;
    return counts;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (status !== "all" && job.status !== status) return false;
        if (fit !== "all" && resolveDisplayBucket(job) !== fit) return false;
        if (q && !`${job.title} ${job.company}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => rankSortPriority(b) - rankSortPriority(a));
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
      render: (job) => (
        <div className="flex items-center gap-1.5">
          <FitPill fit={isLocationExcluded(job) ? "Excluded" : (job.rank_verdict ?? job.fit)} />
          {!isLocationExcluded(job) && typeof job.rank_score === "number" && (
            <span
              className="text-xs font-semibold tabular-nums text-muted"
              title="Triage score out of 100"
            >
              {Math.round(job.rank_score)}
            </span>
          )}
        </div>
      ),
      sortValue: (job) => FIT_BUCKET_RANK[resolveDisplayBucket(job)],
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
      key: "location",
      header: "Location",
      render: (job) =>
        job.location ? (
          <span className="block max-w-[14rem] truncate" title={job.location}>
            {job.location}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
      sortValue: (job) => job.location ?? "",
    },
    {
      key: "salary",
      header: "Salary",
      render: (job) =>
        job.salary ? (
          <span className="block max-w-[12rem] truncate" title={job.salary}>
            {job.salary}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
      sortValue: (job) => job.salary ?? "",
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (job) => {
        const deadline = resolveEffectiveDeadline(job);
        if (!deadline) return <span className="text-muted">—</span>;
        const urgent = isUrgentDeadline(deadline);
        const past = isPastDeadline(deadline);
        return (
          <span
            className={clsx(
              "inline-flex items-center gap-1",
              urgent && "font-semibold text-red-500",
              past && "text-muted line-through",
            )}
          >
            {urgent && "🔥"}
            {deadline}
          </span>
        );
      },
      // Missing deadlines sort last regardless of direction.
      sortValue: (job) => resolveEffectiveDeadline(job) ?? "9999-99-99",
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
      render: (job) => {
        const stale = isStaleNewJob(job);
        return (
          <span
            className={clsx(stale && "font-semibold text-amber-600 dark:text-amber-500")}
            title={stale ? `First seen ${job.first_seen} — still unranked` : job.first_seen}
          >
            {daysAgoLabel(daysSince(job.first_seen))}
          </span>
        );
      },
      sortValue: (job) => job.first_seen,
    },
    {
      key: "actions",
      header: "",
      render: (job) => (
        <div className="flex items-center justify-end gap-2">
          {Boolean(
            job.rank_strengths?.length ||
              job.rank_gaps?.length ||
              job.highlights?.length ||
              job.referral_links,
          ) && (
            <button
              onClick={() => setSelected(job)}
              title="See the reasoning behind this fit score"
              className="flex items-center gap-1 rounded-full border border-signal/25 bg-signal/10 px-2.5 py-1 text-xs font-semibold text-signal transition-transform hover:border-signal/40 hover:bg-signal/15 active:scale-[0.97]"
            >
              <span aria-hidden="true">💡</span> Why?
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
                <button onClick={handleRankAll} disabled={launchRun.isPending} className={primaryButtonClass}>
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
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <section className="flex flex-col rounded-3xl border border-border/10 bg-surface p-4 shadow-sm lg:col-span-2">
                  <SectionHeading>Fit distribution</SectionHeading>
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
                    <Donut
                      size={140}
                      thickness={22}
                      segments={[
                        { label: "High", value: fitCounts.high, color: FIT_COLORS.high },
                        { label: "Medium", value: fitCounts.medium, color: FIT_COLORS.medium },
                        { label: "Low", value: fitCounts.low, color: FIT_COLORS.low },
                      ]}
                    />
                    <Legend
                      layout="chips"
                      items={[
                        { label: "High", value: fitCounts.high, color: FIT_COLORS.high },
                        { label: "Medium", value: fitCounts.medium, color: FIT_COLORS.medium },
                        { label: "Low", value: fitCounts.low, color: FIT_COLORS.low },
                      ]}
                    />
                  </div>
                </section>
                <div className="flex flex-col gap-3">
                  <StatCard label="Total postings" value={jobs.length} accent="#0891b2" align="center" />
                  <StatCard
                    label="High fit"
                    value={fitCounts.high}
                    hint="strong matches"
                    accent={FIT_COLORS.high}
                    align="center"
                  />
                  <StatCard
                    label="Awaiting rank"
                    value={newCount}
                    hint="new since last /rank"
                    accent="#f59e0b"
                    align="center"
                  />
                  {closingSoonCount > 0 && (
                    <StatCard
                      label="Closing soon"
                      value={closingSoonCount}
                      hint="deadline within 7 days"
                      accent="#ef4444"
                      align="center"
                    />
                  )}
                  {fitCounts.excluded > 0 && (
                    <StatCard
                      label="Excluded"
                      value={fitCounts.excluded}
                      hint="location deal-breaker"
                      accent={FIT_COLORS.excluded}
                      align="center"
                    />
                  )}
                </div>
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
                  <FitPill
                    fit={isLocationExcluded(selected) ? "Excluded" : (selected.rank_verdict ?? selected.fit)}
                  />
                  {!isLocationExcluded(selected) && typeof selected.rank_score === "number" && (
                    <NeutralPill>{Math.round(selected.rank_score)}/100</NeutralPill>
                  )}
                  {selected.location && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
                      <span aria-hidden="true">📍</span> {selected.location}
                    </span>
                  )}
                  {selected.salary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
                      <span aria-hidden="true">💰</span> {selected.salary}
                    </span>
                  )}
                  {resolveEffectiveDeadline(selected) && (
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        isUrgentDeadline(resolveEffectiveDeadline(selected))
                          ? "bg-red-500/10 text-red-500"
                          : "bg-surface-2 text-muted",
                      )}
                    >
                      {isUrgentDeadline(resolveEffectiveDeadline(selected)) && "🔥"}
                      Deadline: {resolveEffectiveDeadline(selected)}
                    </span>
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
                {selected.highlights && selected.highlights.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Highlights
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {selected.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                          <span className="text-ink/80">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                {selected.referral_links && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Find a contact
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={selected.referral_links.recruiters}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs font-medium text-signal transition-transform hover:border-signal/40 hover:bg-signal/15 active:scale-[0.97]"
                      >
                        <span aria-hidden="true">🔎</span> Recruiters at {selected.company}
                      </a>
                      <a
                        href={selected.referral_links.team_peers}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/15 px-3 py-1 text-xs font-medium text-muted transition-transform hover:border-signal/30 hover:text-signal active:scale-[0.97]"
                      >
                        <span aria-hidden="true">🤝</span> Team members to ask for a referral
                      </a>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      Opens a LinkedIn people search - a warm intro or referral beats a cold
                      application.
                    </p>
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
