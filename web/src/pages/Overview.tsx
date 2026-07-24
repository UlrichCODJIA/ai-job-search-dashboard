import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useJobs, useTracker } from "../api/queries";
import type { StatusBucket } from "../api/types";
import { ActivityHeatmap } from "../components/charts/ActivityHeatmap";
import { Donut } from "../components/charts/Donut";
import { FunnelChart } from "../components/charts/Funnel";
import { ProgressRing } from "../components/charts/ProgressRing";
import { PageHeader } from "../components/layout/PageHeader";
import { STATUS_COLORS } from "../components/Pill";
import { QueryState } from "../components/QueryState";
import { StatCard } from "../components/StatCard";
import { buildActivityDays } from "../lib/activity";
import { computeFunnel, daysSince, promisingUnappliedJobs, staleActiveRows } from "../lib/pipeline";

const BUCKETS: StatusBucket[] = ["Active", "Interview", "Offer", "Hired", "Rejected/Closed"];

function greeting(): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${timeOfDay}, Armel`;
}

export default function Overview() {
  const jobsQuery = useJobs();
  const trackerQuery = useTracker();
  const [visibleActivityDays, setVisibleActivityDays] = useState(0);

  const jobs = jobsQuery.data ?? [];
  const tracker = trackerQuery.data ?? [];

  const bucketCounts = useMemo(
    () =>
      Object.fromEntries(BUCKETS.map((b) => [b, tracker.filter((r) => r.bucket === b).length])) as Record<
        StatusBucket,
        number
      >,
    [tracker],
  );
  const funnel = useMemo(() => computeFunnel(tracker), [tracker]);
  const activityDays = useMemo(() => buildActivityDays(jobs.map((j) => j.first_seen)), [jobs]);
  const promising = useMemo(() => promisingUnappliedJobs(jobs, tracker).slice(0, 5), [jobs, tracker]);
  const stale = useMemo(() => staleActiveRows(tracker).slice(0, 5), [tracker]);

  const interviewRate = funnel[0].value > 0 ? Math.round((funnel[1].value / funnel[0].value) * 100) : 0;
  const hasAttentionItems = promising.length > 0 || stale.length > 0;

  return (
    <QueryState query={[jobsQuery, trackerQuery]}>
      {() => (
        <div className="flex flex-col gap-4">
          <PageHeader title={greeting()} subtitle="Where your job search stands right now." />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="row-span-2">
              <StatCard
                variant="hero"
                label="Total tracked"
                value={tracker.length}
                hint="applications in your pipeline"
              />
            </div>
            {BUCKETS.map((bucket) => (
              <StatCard key={bucket} label={bucket} value={bucketCounts[bucket]} accent={STATUS_COLORS[bucket]} />
            ))}
            <div className="flex h-full flex-col items-center justify-center gap-0.5 rounded-3xl border border-border/10 bg-surface p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/25 hover:shadow-glow">
              <ProgressRing
                value={interviewRate}
                label="reach interview"
                size={76}
                thickness={9}
                color={STATUS_COLORS.Interview}
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold tracking-tight text-ink">Needs your attention</h2>
              {!hasAttentionItems ? (
                <p className="text-sm text-muted">
                  Nothing urgent right now. Run <code>/scrape</code> to find new postings, or check back
                  after your next application.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {promising.map((job) => (
                    <li key={job.key} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="text-ink/80">
                        <Link to="/discovery" className="font-medium text-ink hover:text-signal hover:underline">
                          {job.title}
                        </Link>{" "}
                        at {job.company} looks like a strong match and hasn't been applied to yet.
                      </span>
                    </li>
                  ))}
                  {stale.map((row) => (
                    <li key={row.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span className="text-ink/80">
                        <Link to="/pipeline" className="font-medium text-ink hover:text-signal hover:underline">
                          {row.role} at {row.company}
                        </Link>{" "}
                        has had no update in {daysSince(row.date)} days. Worth a follow-up or recording
                        an outcome.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold tracking-tight text-ink">Status breakdown</h2>
              <div className="flex items-center gap-6 text-ink">
                <Donut
                  segments={BUCKETS.map((b) => ({ label: b, value: bucketCounts[b], color: STATUS_COLORS[b] }))}
                />
                <ul className="flex flex-1 flex-col gap-1.5 text-xs">
                  {BUCKETS.map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[b] }} />
                      <span className="text-muted">{b}</span>
                      <span className="ml-auto font-bold text-ink">{bucketCounts[b]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold tracking-tight text-ink">Application funnel</h2>
              <FunnelChart stages={funnel} />
            </section>

            <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight text-ink">Scrape activity</h2>
                <span className="text-xs text-muted">last {visibleActivityDays || activityDays.length} days</span>
              </div>
              <ActivityHeatmap days={activityDays} onVisibleDaysChange={setVisibleActivityDays} />
            </section>
          </div>
        </div>
      )}
    </QueryState>
  );
}
