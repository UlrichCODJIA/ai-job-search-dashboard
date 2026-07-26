import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLaunchRun, useUpskillReports } from "../api/queries";
import type { UpskillReport } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { Markdown } from "../components/Markdown";
import { NeutralPill } from "../components/Pill";
import { QueryState } from "../components/QueryState";
import { StatCard } from "../components/StatCard";
import { useTheme } from "../hooks/useTheme";
import { shadeForText } from "../lib/color";
import { inputClass, outlineButtonClass, primaryButtonClass } from "../lib/ui";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#64748b",
};

function ReportView({ report }: { report: UpskillReport }) {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col gap-5">
      {report.sinceLastReport && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Since last report
          </h3>
          <Markdown>{report.sinceLastReport}</Markdown>
        </div>
      )}

      {report.gapHeatmap.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Gap heatmap</h3>
          <div className="overflow-hidden rounded-2xl border border-border/10">
            <div className="thin-scrollbar overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr className="border-b border-border/10">
                    <th className="whitespace-nowrap px-3 py-2">Priority</th>
                    <th className="whitespace-nowrap px-3 py-2">Skill / area</th>
                    <th className="whitespace-nowrap px-3 py-2">Type</th>
                    <th className="whitespace-nowrap px-3 py-2">Gap source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {report.gapHeatmap.map((row, i) => {
                    const color = PRIORITY_COLORS[row.priority.toLowerCase()] ?? "#64748b";
                    return (
                      <tr key={i}>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: `${color}1a`, color: shadeForText(color, theme) }}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{row.skill}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted">{row.type}</td>
                        <td className="px-3 py-2 text-muted">{row.gapSource}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {report.learningPlanRaw && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Learning plan</h3>
          <Markdown>{report.learningPlanRaw}</Markdown>
        </div>
      )}

      {report.suggestedStudyOrder.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Suggested study order
            </h3>
            {report.totalEstimatedTime && <NeutralPill>Total: {report.totalEstimatedTime}</NeutralPill>}
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/10">
            <div className="thin-scrollbar overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr className="border-b border-border/10">
                    <th className="whitespace-nowrap px-3 py-2">#</th>
                    <th className="whitespace-nowrap px-3 py-2">Topic</th>
                    <th className="whitespace-nowrap px-3 py-2">Type</th>
                    <th className="whitespace-nowrap px-3 py-2">Est. time</th>
                    <th className="whitespace-nowrap px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {report.suggestedStudyOrder.map((row, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-3 py-2">{row.order}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{row.topic}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{row.type}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{row.estTime}</td>
                      <td className="px-3 py-2 text-muted">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Upskill() {
  const reportsQuery = useUpskillReports();
  const reports = reportsQuery.data ?? [];
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [targetUrl, setTargetUrl] = useState("");
  const launchRun = useLaunchRun();
  const navigate = useNavigate();

  const latestReport = reports[0];
  const gapStats = useMemo(() => {
    if (!latestReport) return null;
    const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of latestReport.gapHeatmap) {
      const p = row.priority.toLowerCase();
      if (p in byPriority) byPriority[p as keyof typeof byPriority]++;
    }
    return { total: latestReport.gapHeatmap.length, ...byPriority };
  }, [latestReport]);

  const runAggregate = () => {
    launchRun.mutate({ command: "/upskill" }, { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) });
  };
  const runTargeted = () => {
    if (!targetUrl.trim()) return;
    launchRun.mutate(
      { command: "/upskill", args: targetUrl.trim() },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  return (
    <QueryState query={reportsQuery}>
      {() => (
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Upskill"
            subtitle="Skill gaps against your tracked postings, and a study plan to close them."
          />

          <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
            <button
              onClick={runAggregate}
              disabled={launchRun.isPending}
              className={primaryButtonClass}
            >
              Run /upskill
            </button>
            <span className="text-xs text-muted">or target one posting:</span>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="Job posting URL..."
              className={`w-72 flex-1 ${inputClass}`}
            />
            <button
              onClick={runTargeted}
              disabled={launchRun.isPending || !targetUrl.trim()}
              className={outlineButtonClass}
            >
              Run for this posting
            </button>
          </div>

          {gapStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total gaps" value={gapStats.total} />
              <StatCard label="Critical" value={gapStats.critical} accent={PRIORITY_COLORS.critical} />
              <StatCard label="High priority" value={gapStats.high} accent={PRIORITY_COLORS.high} />
              <StatCard
                label="Est. study time"
                value={latestReport?.totalEstimatedTime ?? "N/A"}
                accent={PRIORITY_COLORS.medium}
              />
            </div>
          )}

          {reports.length === 0 ? (
            <EmptyState
              title="No upskill reports yet"
              description="Run /upskill above (or from Claude Code directly) to compare your profile against tracked postings and generate a gap heatmap + learning plan."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {reports.map((report, index) => {
                const defaultOpen = index === 0;
                const isOpen = toggled.has(report.filename) ? !defaultOpen : defaultOpen;
                return (
                  <section
                    key={report.filename}
                    className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm"
                  >
                    <button
                      className="flex w-full items-center justify-between text-left"
                      onClick={() =>
                        setToggled((prev) => {
                          const next = new Set(prev);
                          if (next.has(report.filename)) next.delete(report.filename);
                          else next.add(report.filename);
                          return next;
                        })
                      }
                    >
                      <div>
                        <h2 className="text-base font-bold tracking-tight text-ink">{report.date}</h2>
                        <p className="text-xs text-muted">{report.mode || "Report"}</p>
                      </div>
                      <span className="text-xs text-muted">{isOpen ? "Hide ▲" : "Show ▼"}</span>
                    </button>
                    {isOpen && (
                      <div className="mt-4 border-t border-border/10 pt-4">
                        <ReportView report={report} />
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </QueryState>
  );
}
