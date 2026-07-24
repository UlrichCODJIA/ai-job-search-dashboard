import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { KNOWN_COMMANDS } from "../api/runTypes";
import { useLaunchRun, useReplyToRun, useReports, useRun, useRuns, useStopRun } from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { NeutralPill } from "../components/Pill";
import { PermissionCard } from "../components/PermissionCard";
import { QueryState } from "../components/QueryState";
import { RunLogViewer } from "../components/RunLogViewer";
import { useRunSocket } from "../hooks/useRunSocket";
import { inputClass } from "../lib/ui";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Launcher() {
  const [command, setCommand] = useState<string>(KNOWN_COMMANDS[0]);
  const [args, setArgs] = useState("");
  const launchRun = useLaunchRun();
  const navigate = useNavigate();

  const handleLaunch = () => {
    launchRun.mutate(
      { command, args: args.trim() || undefined },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  return (
    <div className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ink">Launch a command</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select value={command} onChange={(e) => setCommand(e.target.value)} className={inputClass}>
          {KNOWN_COMMANDS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder="Optional arguments (URL, company name, ...)"
          className={`w-72 flex-1 ${inputClass}`}
        />
        <button
          onClick={handleLaunch}
          disabled={launchRun.isPending}
          className="rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {launchRun.isPending ? "Starting..." : "Launch"}
        </button>
      </div>
      {launchRun.isError && (
        <p className="mt-2 text-xs text-red-500">{(launchRun.error as Error).message}</p>
      )}
    </div>
  );
}

function ReplyBox({ runId }: { runId: string }) {
  const [message, setMessage] = useState("");
  const replyToRun = useReplyToRun();
  const navigate = useNavigate();

  const handleSend = () => {
    if (!message.trim()) return;
    replyToRun.mutate(
      { id: runId, message: message.trim() },
      { onSuccess: ({ runId: newRunId }) => navigate(`/runs/${newRunId}`) },
    );
  };

  return (
    <div className="border-t border-border/10 pt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Reply to continue this conversation
      </p>
      <p className="mb-2 text-xs text-muted">
        Some commands pause to ask a question (e.g. "should I proceed?"). Answer here to continue the same
        session, picking up right where it left off.
      </p>
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type your reply (e.g. yes, or feedback)..."
          className={inputClass + " flex-1"}
        />
        <button
          onClick={handleSend}
          disabled={replyToRun.isPending || !message.trim()}
          className="rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {replyToRun.isPending ? "Sending..." : "Send reply"}
        </button>
      </div>
      {replyToRun.isError && (
        <p className="mt-2 text-xs text-red-500">{(replyToRun.error as Error).message}</p>
      )}
    </div>
  );
}

function RunDetail({ runId }: { runId: string }) {
  const { events, connected, pendingPermissions, respond } = useRunSocket(runId);
  const runQuery = useRun(runId);
  const stopRun = useStopRun();
  const isRunning = runQuery.data?.status === "running";
  const canReply = !isRunning && Boolean(runQuery.data?.sessionId);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Run <span className="font-mono text-xs text-muted">{runId.slice(0, 8)}</span>
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              connected ? "bg-signal/10 text-signal" : "bg-surface-2 text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-signal" : "bg-muted"}`} />
            {connected ? "live" : "disconnected"}
          </span>
          {isRunning && (
            <button
              onClick={() => stopRun.mutate(runId)}
              disabled={stopRun.isPending}
              className="rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white transition-transform hover:bg-red-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {stopRun.isPending ? "Stopping..." : "■ Stop"}
            </button>
          )}
        </div>
      </div>
      {pendingPermissions.length > 0 && (
        <div className="flex flex-col gap-2">
          {pendingPermissions.map((p) => (
            <PermissionCard
              key={p.toolUseID}
              permission={p}
              onRespond={(approved) => respond(p.toolUseID, approved)}
            />
          ))}
        </div>
      )}
      <RunLogViewer events={events} />
      {canReply && <ReplyBox runId={runId} />}
    </div>
  );
}

function Reports() {
  const reportsQuery = useReports();
  const reports = reportsQuery.data ?? [];

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ink">Reports</h2>
      <QueryState query={reportsQuery}>
        {() =>
          reports.length === 0 ? (
            <p className="text-sm text-muted">
              Run <code>/html-report</code> above to generate a self-contained HTML tracker dashboard --
              it'll show up here to open.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {reports.map((report) => (
                <a
                  key={report.filename}
                  href={`/api/reports/${encodeURIComponent(report.filename)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-2xl border border-border/10 px-3 py-2 text-sm transition-colors hover:border-signal/20"
                >
                  <span className="font-medium text-ink">{report.filename}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(report.modifiedAt).toLocaleString()}
                  </span>
                </a>
              ))}
            </div>
          )
        }
      </QueryState>
    </section>
  );
}

export default function Runs() {
  const { runId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const runsQuery = useRuns();
  const runs = runsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Runs"
        subtitle="Launch Claude Code workflows and watch them stream live, right here."
      />

      <Launcher />

      {/* key={runId} forces a full remount per run -- otherwise ReplyBox's
          draft text and mutation/error state (isPending/isError) would leak
          across runs when navigating from one run's page straight to another's. */}
      {runId && <RunDetail key={runId} runId={runId} />}

      <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-ink">History</h2>
        <QueryState query={runsQuery}>
          {() =>
            runs.length === 0 ? (
              <EmptyState
                title="No runs yet"
                description="Launch a command above, or use a contextual action from Discovery, Pipeline, or Upskill."
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => navigate(`/runs/${run.id}`)}
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
                      run.id === runId
                        ? "border-signal/30 bg-signal/[0.06]"
                        : "border-border/10 hover:border-signal/20"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 font-medium text-ink">{run.command}</span>
                      {run.args && <span className="min-w-0 truncate text-xs text-muted">{run.args}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      {run.status === "running" && <NeutralPill>running</NeutralPill>}
                      {run.status === "completed" && <NeutralPill>done</NeutralPill>}
                      {run.status === "error" && <NeutralPill>error</NeutralPill>}
                      {run.status === "stopped" && <NeutralPill>stopped</NeutralPill>}
                      {relativeTime(run.startedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )
          }
        </QueryState>
      </section>

      <Reports />
    </div>
  );
}
