import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { KNOWN_COMMANDS } from "../api/runTypes";
import type { RunEvent, RunRecord } from "../api/runTypes";
import {
  useDeleteRun,
  useLaunchRun,
  useReplyToRun,
  useReports,
  useRun,
  useRunLogs,
  useRuns,
  useStopRun,
} from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import {
  InlineSectionHeading,
  SectionHeading,
} from "../components/layout/SectionHeading";
import { NeutralPill, Pill } from "../components/Pill";
import { AutoGrowTextarea } from "../components/AutoGrowTextarea";
import { PermissionCard } from "../components/PermissionCard";
import { QuestionCard } from "../components/QuestionCard";
import { QueryState } from "../components/QueryState";
import { RunLogViewer } from "../components/RunLogViewer";
import { useConfirm } from "../hooks/useConfirm";
import { useRunSocket } from "../hooks/useRunSocket";
import { countRunningAgents } from "../lib/runAgents";
import { inputClass, primaryButtonClass } from "../lib/ui";

const RUN_STATUS_COLORS: Record<string, string> = {
  running: "#0891b2",
  completed: "#22c55e",
  error: "#ef4444",
  stopped: "#64748b",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface RunThread {
  rootId: string;
  rootRun: RunRecord;
  latestRun: RunRecord;
  replyCount: number;
}

function groupIntoThreads(runs: RunRecord[]): RunThread[] {
  const groups = new Map<string, RunRecord[]>();
  for (const run of runs) {
    const rootId = run.threadRootId ?? run.id;
    const group = groups.get(rootId);
    if (group) group.push(run);
    else groups.set(rootId, [run]);
  }
  const threads: RunThread[] = [];
  for (const [rootId, members] of groups) {
    const sorted = [...members].sort((a, b) => a.startedAt - b.startedAt);
    threads.push({
      rootId,
      rootRun: sorted.find((r) => r.id === rootId) ?? sorted[0],
      latestRun: sorted[sorted.length - 1],
      replyCount: sorted.length - 1,
    });
  }
  return threads.sort((a, b) => b.latestRun.startedAt - a.latestRun.startedAt);
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
      <SectionHeading>Launch a command</SectionHeading>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className={inputClass}
        >
          {KNOWN_COMMANDS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <AutoGrowTextarea
          value={args}
          onChange={setArgs}
          onSubmit={handleLaunch}
          placeholder="Optional arguments (URL, company name, ...) -- Shift+Enter for a new line"
          className="w-72 flex-1 py-1.5"
          maxRows={4}
        />
        <button
          onClick={handleLaunch}
          disabled={launchRun.isPending}
          className={primaryButtonClass}
        >
          {launchRun.isPending ? "Starting..." : "Launch"}
        </button>
      </div>
      {launchRun.isError && (
        <p className="mt-2 text-xs text-red-500">
          {(launchRun.error as Error).message}
        </p>
      )}
    </div>
  );
}

function ReplyBox({ runId, rootRunId }: { runId: string; rootRunId: string }) {
  const [message, setMessage] = useState("");
  const replyToRun = useReplyToRun();
  const navigate = useNavigate();

  const handleSend = () => {
    if (!message.trim()) return;
    replyToRun.mutate(
      { id: runId, message: message.trim() },
      { onSuccess: () => navigate(`/runs/${rootRunId}`) },
    );
  };

  return (
    <div className="border-t border-border/10 pt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Reply to continue this conversation
      </p>
      <p className="mb-2 text-xs text-muted">
        Some commands pause to ask a question (e.g. "should I proceed?"). Answer
        here to continue the same session, picking up right where it left off.
      </p>
      <div className="flex gap-2">
        <AutoGrowTextarea
          value={message}
          onChange={setMessage}
          onSubmit={handleSend}
          placeholder="Type your reply (e.g. yes, or feedback)... -- Shift+Enter for a new line"
          className="flex-1 py-1.5"
          maxRows={8}
        />
        <button
          onClick={handleSend}
          disabled={replyToRun.isPending || !message.trim()}
          className={primaryButtonClass}
        >
          {replyToRun.isPending ? "Sending..." : "Send reply"}
        </button>
      </div>
      {replyToRun.isError && (
        <p className="mt-2 text-xs text-red-500">
          {(replyToRun.error as Error).message}
        </p>
      )}
    </div>
  );
}

function RunDetail({ runId, runs }: { runId: string; runs: RunRecord[] }) {
  const thread = useMemo(() => {
    const current = runs.find((r) => r.id === runId);
    const rootId = current?.threadRootId ?? runId;
    return runs
      .filter((r) => (r.threadRootId ?? r.id) === rootId)
      .sort((a, b) => a.startedAt - b.startedAt);
  }, [runs, runId]);

  const latestRun = thread[thread.length - 1];
  const latestRunId = latestRun?.id ?? runId;
  const rootRunId = thread[0]?.id ?? runId;
  const historicalRuns = thread.slice(0, -1);

  const {
    events: liveEvents,
    connected,
    pendingPermissions,
    respond,
    pendingQuestions,
    answerQuestion,
    skipQuestion,
  } = useRunSocket(latestRunId);
  const historicalLogResults = useRunLogs(historicalRuns.map((r) => r.id));

  const events = useMemo(() => {
    const merged: RunEvent[] = [];
    thread.forEach((run, i) => {
      if (i > 0) {
        merged.push({
          type: "thread_reply",
          message: run.args ?? "",
          repliedAt: run.startedAt,
        });
      }
      if (run.id === latestRunId) {
        merged.push(...liveEvents);
      } else {
        const historicalIndex = historicalRuns.findIndex(
          (r) => r.id === run.id,
        );
        merged.push(...(historicalLogResults[historicalIndex]?.data ?? []));
      }
    });
    return merged;
  }, [thread, latestRunId, liveEvents, historicalRuns, historicalLogResults]);

  const runQuery = useRun(latestRunId);
  const stopRun = useStopRun();
  const isRunning = runQuery.data?.status === "running";
  const canReply = !isRunning && Boolean(runQuery.data?.sessionId);
  const hasResumeFailure = thread.some((r) => r.resumeFailed);
  const runningAgentCount = useMemo(() => countRunningAgents(events), [events]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <InlineSectionHeading>
          Run{" "}
          <span className="font-mono text-xs normal-case text-muted">
            {rootRunId.slice(0, 8)}
          </span>
          {thread.length > 1 && (
            <span className="normal-case text-muted">
              {" "}
              · {thread.length - 1} {thread.length === 2 ? "reply" : "replies"}
            </span>
          )}
        </InlineSectionHeading>
        <div className="flex items-center gap-2">
          {hasResumeFailure && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
              title="A reply in this thread couldn't resume its session and started fresh with no prior context -- see the log for where."
            >
              ⚠ resume failed
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              connected ? "bg-signal/10 text-signal" : "bg-surface-2 text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-signal" : "bg-muted"}`}
            />
            {connected ? "live" : "disconnected"}
          </span>
          {isRunning && runningAgentCount > 0 && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-signal/10 px-2 py-0.5 text-[10px] font-medium text-signal"
              title="Subagents Claude spawned to work in parallel (e.g. checking multiple job portals at once) that haven't reported back yet"
            >
              ⟳ {runningAgentCount} agent{runningAgentCount === 1 ? "" : "s"} running
            </span>
          )}
          {isRunning && (
            <button
              onClick={() => stopRun.mutate(latestRunId)}
              disabled={stopRun.isPending}
              className="rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white transition-transform hover:bg-red-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {stopRun.isPending ? "Stopping..." : "■ Stop"}
            </button>
          )}
        </div>
      </div>
      {(pendingQuestions.length > 0 || pendingPermissions.length > 0) && (
        <div className="flex flex-col gap-2">
          {pendingQuestions.map((q) => (
            <QuestionCard
              key={q.toolUseID}
              question={q}
              onAnswer={(answers) => answerQuestion(q.toolUseID, answers)}
              onSkip={() => skipQuestion(q.toolUseID)}
            />
          ))}
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
      {canReply && <ReplyBox runId={latestRunId} rootRunId={rootRunId} />}
    </div>
  );
}

function Reports() {
  const reportsQuery = useReports();
  const reports = reportsQuery.data ?? [];

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <SectionHeading>Reports</SectionHeading>
      <QueryState query={reportsQuery}>
        {() =>
          reports.length === 0 ? (
            <p className="text-sm text-muted">
              Run <code>/html-report</code> above to generate a self-contained
              HTML tracker dashboard -- it'll show up here to open.
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
                  <span className="font-medium text-ink">
                    {report.filename}
                  </span>
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

function ThreadRow({
  thread,
  isActive,
}: {
  thread: RunThread;
  isActive: boolean;
}) {
  const { rootId, rootRun, latestRun, replyCount } = thread;
  const navigate = useNavigate();
  const deleteRun = useDeleteRun();
  const confirmDelete = useConfirm<string>();
  const isRunning = latestRun.status === "running";
  const isArmed = confirmDelete.isArmed(rootId);

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isArmed) {
      confirmDelete.arm(rootId);
      return;
    }
    deleteRun.mutate(rootId, {
      onSuccess: () => {
        confirmDelete.disarm();
        if (isActive) navigate("/runs");
      },
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => navigate(`/runs/${latestRun.id}`)}
        className={`flex flex-1 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
          isActive
            ? "border-signal/30 bg-signal/[0.06]"
            : "border-border/10 hover:border-signal/20"
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-medium text-ink">
            {rootRun.command}
          </span>
          {rootRun.args && (
            <span className="min-w-0 truncate text-xs text-muted">
              {rootRun.args}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {replyCount > 0 && (
            <NeutralPill>
              +{replyCount} {replyCount === 1 ? "reply" : "replies"}
            </NeutralPill>
          )}
          {latestRun.status === "running" && (
            <Pill color={RUN_STATUS_COLORS.running}>running</Pill>
          )}
          {latestRun.status === "completed" && (
            <Pill color={RUN_STATUS_COLORS.completed}>done</Pill>
          )}
          {latestRun.status === "error" && (
            <Pill color={RUN_STATUS_COLORS.error}>error</Pill>
          )}
          {latestRun.status === "stopped" && (
            <Pill color={RUN_STATUS_COLORS.stopped}>stopped</Pill>
          )}
          {relativeTime(latestRun.startedAt)}
        </span>
      </button>
      <button
        onClick={handleDelete}
        disabled={deleteRun.isPending || isRunning}
        title={
          isRunning
            ? "Stop this run before deleting it"
            : isArmed
              ? "Click again to permanently delete this run and its replies"
              : "Delete this run"
        }
        className={`shrink-0 rounded-full border px-2.5 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isArmed
            ? "border-red-500/40 bg-red-500/10 text-red-500"
            : "border-border/10 text-muted hover:border-red-500/30 hover:text-red-500"
        }`}
      >
        {deleteRun.isPending ? "..." : isArmed ? "Confirm?" : "✕"}
      </button>
    </div>
  );
}

export default function Runs() {
  const { runId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const runsQuery = useRuns();
  const runs = runsQuery.data ?? [];
  const threads = useMemo(() => groupIntoThreads(runs), [runs]);
  const activeRootId = runId
    ? (runs.find((r) => r.id === runId)?.threadRootId ?? runId)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Runs"
        subtitle="Launch Claude Code workflows and watch them stream live, right here."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Launcher />
        <Reports />
      </div>

      {runId && <RunDetail key={runId} runId={runId} runs={runs} />}

      <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
        <SectionHeading>History</SectionHeading>
        <QueryState query={runsQuery}>
          {() =>
            threads.length === 0 ? (
              <EmptyState
                title="No runs yet"
                description="Launch a command above, or use a contextual action from Discovery, Pipeline, or Upskill."
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                {threads.map((thread) => (
                  <ThreadRow
                    key={thread.rootId}
                    thread={thread}
                    isActive={thread.rootId === activeRootId}
                  />
                ))}
              </div>
            )
          }
        </QueryState>
      </section>
    </div>
  );
}
