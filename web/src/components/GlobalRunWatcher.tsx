import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRuns } from "../api/queries";
import type { RunRecord, RunStatus } from "../api/runTypes";
import { useToast } from "./Toast";

function commandLabel(run: RunRecord): string {
  return run.args ? `${run.command} ${run.args}` : run.command;
}

interface RunSnapshot {
  status: RunStatus;
  pendingApprovals: number;
}

/** Runs poll every 5s regardless of which page is open (see useRuns), so this
 * component can diff snapshots across polls and surface a toast the moment a
 * background run finishes or needs approval -- without it, the only way to
 * notice was to keep the Runs tab open and stare at it. */
export function GlobalRunWatcher() {
  const { data } = useRuns();
  const { push } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const prevRef = useRef<Map<string, RunSnapshot> | null>(null);
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  useEffect(() => {
    if (!data) return;
    const prev = prevRef.current;

    if (prev) {
      for (const run of data) {
        const before = prev.get(run.id);
        const viewingThisRun = locationRef.current === `/runs/${run.id}`;
        const pendingApprovals = run.pendingApprovals ?? 0;
        const label = commandLabel(run);

        if (before?.status === "running" && run.status !== "running" && !viewingThisRun) {
          if (run.status === "completed") {
            push({
              tone: "success",
              title: `${label} finished`,
              description: run.costUsd != null ? `$${run.costUsd.toFixed(3)} · done` : "Done",
              action: { label: "View", onClick: () => navigate(`/runs/${run.id}`) },
            });
          } else if (run.status === "error") {
            push({
              tone: "error",
              title: `${label} failed`,
              description: run.error,
              action: { label: "View", onClick: () => navigate(`/runs/${run.id}`) },
            });
          } else if (run.status === "stopped") {
            push({
              tone: "warning",
              title: `${label} stopped`,
              action: { label: "View", onClick: () => navigate(`/runs/${run.id}`) },
            });
          }
        }

        if ((before?.pendingApprovals ?? 0) === 0 && pendingApprovals > 0 && !viewingThisRun) {
          push({
            tone: "warning",
            title: `${label} needs your approval`,
            description: pendingApprovals > 1 ? `${pendingApprovals} tool calls waiting` : "A tool call is waiting",
            action: { label: "Review", onClick: () => navigate(`/runs/${run.id}`) },
          });
        }
      }
    }

    prevRef.current = new Map(
      data.map((run) => [run.id, { status: run.status, pendingApprovals: run.pendingApprovals ?? 0 }]),
    );
  }, [data, push, navigate]);

  return null;
}
