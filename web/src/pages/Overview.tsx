import clsx from "clsx";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useJobs, useLaunchRun, useProfile, useTracker } from "../api/queries";
import type { ScrapedJob, StatusBucket, TrackerRow } from "../api/types";
import { ActivityHeatmap } from "../components/charts/ActivityHeatmap";
import { AreaChart } from "../components/charts/AreaChart";
import { HorizontalBarChart } from "../components/charts/BarChart";
import { Donut } from "../components/charts/Donut";
import { Legend } from "../components/charts/Legend";
import {
  InlineSectionHeading,
  SectionHeading,
} from "../components/layout/SectionHeading";
import { STATUS_COLORS } from "../components/Pill";
import { QueryState } from "../components/QueryState";
import { StatCard } from "../components/StatCard";
import { TrendIndicator } from "../components/TrendIndicator";
import { buildActivityDays } from "../lib/activity";
import { isUrgentDeadline } from "../lib/deadline";
import {
  computeFunnel,
  daysSince,
  groupCount,
  promisingUnappliedJobs,
  staleActiveRows,
  staleDraftRows,
  staleInterviewRows,
} from "../lib/pipeline";
import { outlineButtonClass } from "../lib/ui";

const BUCKETS: StatusBucket[] = [
  "Drafted",
  "Active",
  "Interview",
  "Offer",
  "Hired",
  "Rejected/Closed",
];

function FirstRunChecklist({
  jobs,
  tracker,
}: {
  jobs: ScrapedJob[];
  tracker: TrackerRow[];
}) {
  const launchRun = useLaunchRun();
  const navigate = useNavigate();

  const steps = [
    {
      key: "scrape",
      label: "Scrape for postings",
      description: "Search job portals for openings that match your search queries.",
      command: "/scrape",
      done: jobs.length > 0,
    },
    {
      key: "rank",
      label: "Rank what you found",
      description: "Triage postings by fit before spending time on any of them.",
      command: "/rank",
      done: jobs.some((j) => j.status !== "new"),
    },
    {
      key: "apply",
      label: "Draft your first application",
      description: "Tailor a CV and cover letter for a posting you like.",
      command: "/apply",
      done: tracker.length > 0,
    },
  ];

  return (
    <section className="rounded-3xl border border-signal/20 bg-signal/[0.04] p-4 shadow-sm">
      <InlineSectionHeading>Let's get your search moving</InlineSectionHeading>
      <p className="mb-3 text-xs text-muted">
        Already run <code>/setup</code>? Here's what's next in the framework's core loop.
      </p>
      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.key}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/10 bg-surface px-3 py-2.5"
          >
            <div className="flex items-start gap-2.5">
              <span
                className={clsx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  step.done
                    ? "bg-signal text-signal-ink"
                    : "border border-border/20 text-muted",
                )}
              >
                {step.done ? "✓" : ""}
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{step.label}</p>
                <p className="text-xs text-muted">{step.description}</p>
              </div>
            </div>
            {!step.done && (
              <button
                onClick={() =>
                  launchRun.mutate(
                    { command: step.command },
                    { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
                  )
                }
                disabled={launchRun.isPending}
                className={`shrink-0 ${outlineButtonClass}`}
              >
                Launch
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function greeting(name?: string | null): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `Good ${timeOfDay}, ${firstName}` : `Good ${timeOfDay}`;
}

export default function Overview() {
  const jobsQuery = useJobs();
  const trackerQuery = useTracker();
  const profileQuery = useProfile();
  const [visibleActivityDays, setVisibleActivityDays] = useState(0);

  const jobs = jobsQuery.data ?? [];
  const tracker = trackerQuery.data ?? [];

  const bucketCounts = useMemo(
    () =>
      Object.fromEntries(
        BUCKETS.map((b) => [b, tracker.filter((r) => r.bucket === b).length]),
      ) as Record<StatusBucket, number>,
    [tracker],
  );
  const funnel = useMemo(() => computeFunnel(tracker), [tracker]);
  const sectorCounts = useMemo(
    () => groupCount(tracker, "sector").slice(0, 6),
    [tracker],
  );
  const activityDays = useMemo(
    () => buildActivityDays(jobs.map((j) => j.first_seen)),
    [jobs],
  );
  const promising = useMemo(
    () => promisingUnappliedJobs(jobs, tracker).slice(0, 5),
    [jobs, tracker],
  );
  const stale = useMemo(
    () =>
      [
        ...staleActiveRows(tracker),
        ...staleDraftRows(tracker),
        ...staleInterviewRows(tracker),
      ].slice(0, 5),
    [tracker],
  );
  const upcomingInterviews = useMemo(
    () => tracker.filter((r) => isUrgentDeadline(r.next_interview_date)).slice(0, 5),
    [tracker],
  );

  const interviewRate =
    funnel[0].value > 0
      ? Math.round((funnel[1].value / funnel[0].value) * 100)
      : 0;
  const hasAttentionItems =
    upcomingInterviews.length > 0 || promising.length > 0 || stale.length > 0;

  const last7Count = useMemo(
    () => activityDays.slice(-7).reduce((s, d) => s + d.count, 0),
    [activityDays],
  );
  const prev7Count = useMemo(
    () => activityDays.slice(-14, -7).reduce((s, d) => s + d.count, 0),
    [activityDays],
  );
  const momentumDirection: "up" | "down" | "flat" =
    last7Count === prev7Count
      ? "flat"
      : last7Count > prev7Count
        ? "up"
        : "down";
  const momentumLabel =
    prev7Count === 0
      ? last7Count === 0
        ? "no change"
        : `+${last7Count} vs 0`
      : `${last7Count >= prev7Count ? "+" : ""}${Math.round(((last7Count - prev7Count) / prev7Count) * 100)}%`;

  return (
    <QueryState query={[jobsQuery, trackerQuery]}>
      {() => (
        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-3xl bg-signal lg:relative lg:isolate lg:h-80">
            <div className="p-6 sm:p-8 lg:absolute lg:inset-0 lg:z-10 lg:flex lg:h-full lg:flex-col lg:justify-center">
              <h1 className="text-xl font-bold uppercase tracking-tight text-white lg:text-3xl lg:drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] xl:text-4xl">
                {greeting(profileQuery.data?.name)}
              </h1>
              <p className="mt-1 text-sm text-white/90 lg:mt-3 lg:max-w-sm lg:text-base lg:drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)] xl:text-lg">
                Where your job search stands right now.
              </p>
            </div>
            <img
              src="/overview-hero.webp"
              alt=""
              className="h-40 w-full select-none object-contain object-bottom sm:h-52 lg:absolute lg:inset-0 lg:h-full lg:object-right-bottom"
            />
          </section>

          {tracker.length === 0 && <FirstRunChecklist jobs={jobs} tracker={tracker} />}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {BUCKETS.map((bucket) => (
              <StatCard
                key={bucket}
                label={bucket}
                value={bucketCounts[bucket]}
                accent={STATUS_COLORS[bucket]}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <section className="flex h-full flex-col justify-between rounded-3xl border border-border/10 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/25 hover:shadow-glow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted">
                    Total tracked
                  </p>
                  <p className="text-2xl font-semibold text-ink">
                    {tracker.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted">Last 7 days</p>
                  <p className="text-2xl font-semibold text-ink">
                    {last7Count}
                  </p>
                  <TrendIndicator
                    direction={momentumDirection}
                    label={momentumLabel}
                  />
                </div>
              </div>
              <div className="mt-3 h-16">
                <AreaChart data={activityDays.slice(-30)} />
              </div>
            </section>

            <section className="flex h-full flex-col justify-between rounded-3xl border border-border/10 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/25 hover:shadow-glow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted">
                    Reach interview
                  </p>
                  <p className="text-2xl font-semibold text-ink">
                    {interviewRate}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted">Offers</p>
                  <p className="text-2xl font-semibold text-ink">
                    {bucketCounts.Offer}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-signal to-accent-2 transition-all duration-500"
                    style={{ width: `${interviewRate}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {funnel[1]?.value ?? 0} of {funnel[0]?.value ?? 0}{" "}
                  applications reached interview
                </p>
              </div>
            </section>

            <section className="flex h-full flex-col rounded-3xl border border-border/10 bg-surface p-4 shadow-sm lg:row-span-2">
              <SectionHeading>Sector focus</SectionHeading>
              <div className="flex flex-1 flex-col justify-center">
                <HorizontalBarChart bars={sectorCounts} />
              </div>
            </section>

            <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
              <SectionHeading>Needs your attention</SectionHeading>
              {!hasAttentionItems ? (
                <p className="text-sm text-muted">
                  Nothing urgent right now. Run <code>/scrape</code> to find new
                  postings, or check back after your next application.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {upcomingInterviews.map((row) => (
                    <li key={row.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span className="text-ink/80">
                        🔥{" "}
                        <Link
                          to="/pipeline"
                          className="font-medium text-ink hover:text-signal hover:underline"
                        >
                          {row.role} at {row.company}
                        </Link>{" "}
                        has an interview on {row.next_interview_date} - make sure your
                        prep is ready.
                      </span>
                    </li>
                  ))}
                  {promising.map((job) => (
                    <li
                      key={job.key}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="text-ink/80">
                        <Link
                          to="/discovery"
                          className="font-medium text-ink hover:text-signal hover:underline"
                        >
                          {job.title}
                        </Link>{" "}
                        at {job.company} looks like a strong match and hasn't
                        been applied to yet.
                      </span>
                    </li>
                  ))}
                  {stale.map((row) => (
                    <li key={row.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span className="text-ink/80">
                        <Link
                          to="/pipeline"
                          className="font-medium text-ink hover:text-signal hover:underline"
                        >
                          {row.role} at {row.company}
                        </Link>{" "}
                        {row.bucket === "Drafted"
                          ? `was drafted ${daysSince(row.date)} days ago and never submitted. Decide whether to send it, or dismiss it.`
                          : row.bucket === "Interview"
                            ? `had an interview that's likely already happened, with no outcome logged - most employers who respond do so within 1-2 weeks, so run /outcome to record what happened either way.`
                            : `has had no update in ${daysSince(row.date)} days. Worth a follow-up or recording an outcome.`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
              <SectionHeading>Status breakdown</SectionHeading>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2 text-ink">
                <Donut
                  segments={BUCKETS.map((b) => ({
                    label: b,
                    value: bucketCounts[b],
                    color: STATUS_COLORS[b],
                  }))}
                />
                <Legend
                  layout="chips"
                  items={BUCKETS.map((b) => ({
                    label: b,
                    value: bucketCounts[b],
                    color: STATUS_COLORS[b],
                  }))}
                />
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <InlineSectionHeading>Scrape activity</InlineSectionHeading>
              <span className="text-xs text-muted">
                last {visibleActivityDays || activityDays.length} days
              </span>
            </div>
            <ActivityHeatmap
              days={activityDays}
              onVisibleDaysChange={setVisibleActivityDays}
            />
          </section>
        </div>
      )}
    </QueryState>
  );
}
