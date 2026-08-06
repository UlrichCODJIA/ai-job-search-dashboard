import { errorResponse, json } from "../lib/http.js";
import { startRun, stopRun } from "../lib/claudeRunner.js";
import {
  deleteThread,
  getRun,
  listRuns,
  type RunPermissionMode,
  type RunRecord,
} from "../lib/runStore.js";
import { deleteRunEvents, getEventLog, getPendingApprovalCount } from "../ws/hub.js";

const KNOWN_COMMANDS = new Set([
  "/setup",
  "/scrape",
  "/rank",
  "/apply",
  "/interview",
  "/outcome",
  "/upskill",
  "/html-report",
  "/expand",
  "/add-template",
  "/add-portal",
  "/reset",
  "/notion-sync",
]);

const ALLOWED_PERMISSION_MODES = new Set<RunPermissionMode>([
  "default",
  "acceptEdits",
]);

interface StartRunBody {
  command?: string;
  args?: string;
  resumeKey?: string;
  permissionMode?: string;
}

export function parsePermissionMode(
  value: string | undefined,
): RunPermissionMode | undefined {
  if (value === undefined) return undefined;
  if (!ALLOWED_PERMISSION_MODES.has(value as RunPermissionMode)) {
    throw new Error(
      `permissionMode must be one of: ${[...ALLOWED_PERMISSION_MODES].join(", ")}`,
    );
  }
  return value as RunPermissionMode;
}

function withPendingApprovals(run: RunRecord) {
  return {
    ...run,
    pendingApprovals:
      run.status === "running" ? getPendingApprovalCount(run.id) : 0,
  };
}

export const runsRoutes = {
  "/api/runs": {
    GET: async () => json((await listRuns()).map(withPendingApprovals)),
    POST: async (req: Request) => {
      const body = (await req.json().catch(() => null)) as StartRunBody | null;
      if (!body?.command || !KNOWN_COMMANDS.has(body.command)) {
        return errorResponse(
          `command must be one of: ${[...KNOWN_COMMANDS].join(", ")}`,
        );
      }
      let permissionMode: RunPermissionMode | undefined;
      try {
        permissionMode = parsePermissionMode(body.permissionMode);
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
      const runId = await startRun({
        command: body.command,
        args: body.args,
        resumeKey: body.resumeKey,
        permissionMode,
      });
      return json({ runId }, { status: 201 });
    },
  },
  "/api/runs/:id": {
    GET: async (req: Request & { params: { id: string } }) => {
      const run = await getRun(decodeURIComponent(req.params.id));
      if (!run) return errorResponse("run not found", 404);
      return json(withPendingApprovals(run));
    },
    DELETE: async (req: Request & { params: { id: string } }) => {
      const id = decodeURIComponent(req.params.id);
      const current = await getRun(id);
      if (!current) return errorResponse("run not found", 404);
      const rootId = current.threadRootId ?? current.id;
      const all = await listRuns();
      const threadRuns = all.filter(
        (r) => (r.threadRootId ?? r.id) === rootId,
      );
      if (threadRuns.some((r) => r.status === "running")) {
        return errorResponse(
          "stop this run before deleting it -- one of its replies is still in progress",
        );
      }
      const deleted = await deleteThread(rootId);
      for (const run of deleted) {
        await deleteRunEvents(run.id);
      }
      return json({ deletedIds: deleted.map((r) => r.id) });
    },
  },
  "/api/runs/:id/stop": {
    POST: async (req: Request & { params: { id: string } }) => {
      const stopped = stopRun(decodeURIComponent(req.params.id));
      if (!stopped)
        return errorResponse("run not found or already finished", 404);
      return json({ stopped: true });
    },
  },
  "/api/runs/:id/log": {
    GET: async (req: Request & { params: { id: string } }) => {
      const id = decodeURIComponent(req.params.id);
      const run = await getRun(id);
      if (!run) return errorResponse("run not found", 404);
      return json(getEventLog(id));
    },
  },
  "/api/runs/:id/reply": {
    POST: async (req: Request & { params: { id: string } }) => {
      const id = decodeURIComponent(req.params.id);
      const original = await getRun(id);
      if (!original) return errorResponse("run not found", 404);
      if (original.status === "running") {
        return errorResponse(
          "this run is still in progress; wait for it to finish its current turn first",
        );
      }
      if (!original.sessionId) {
        return errorResponse(
          "this run has no session to continue (it may have errored before starting, or never initialized)",
        );
      }
      const body = (await req.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!body || typeof body.message !== "string" || !body.message.trim()) {
        return errorResponse("body must be { message: string }");
      }
      const runId = await startRun({
        command: original.command,
        args: body.message.trim(),
        resumeSessionId: original.sessionId,
        threadRootId: original.threadRootId ?? original.id,
      });
      return json({ runId }, { status: 201 });
    },
  },
};
