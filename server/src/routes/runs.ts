import { errorResponse, json } from "../lib/http.js";
import { startRun, stopRun } from "../lib/claudeRunner.js";
import { getRun, listRuns, type RunRecord } from "../lib/runStore.js";
import { getPendingApprovalCount } from "../ws/hub.js";

// Every slash command this repo ships (README.md's "Other commands" section)
// plus the core /setup -> /scrape -> /apply lifecycle. Anything else is refused
// rather than passed through to the SDK as an arbitrary prompt. /reset and
// /notion-sync were historically left out here on the assumption their
// conversational confirmation steps couldn't work from the dashboard -- the
// /api/runs/:id/reply route now lets the user answer those prompts, so both
// are included like everything else.
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

interface StartRunBody {
  command?: string;
  args?: string;
  resumeKey?: string;
}

function withPendingApprovals(run: RunRecord) {
  return { ...run, pendingApprovals: run.status === "running" ? getPendingApprovalCount(run.id) : 0 };
}

export const runsRoutes = {
  "/api/runs": {
    GET: async () => json((await listRuns()).map(withPendingApprovals)),
    POST: async (req: Request) => {
      const body = (await req.json().catch(() => null)) as StartRunBody | null;
      if (!body?.command || !KNOWN_COMMANDS.has(body.command)) {
        return errorResponse(`command must be one of: ${[...KNOWN_COMMANDS].join(", ")}`);
      }
      const runId = await startRun({
        command: body.command,
        args: body.args,
        resumeKey: body.resumeKey,
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
  },
  "/api/runs/:id/stop": {
    POST: async (req: Request & { params: { id: string } }) => {
      const stopped = stopRun(decodeURIComponent(req.params.id));
      if (!stopped) return errorResponse("run not found or already finished", 404);
      return json({ stopped: true });
    },
  },
  // A one-shot query() ends its turn the moment the agent's own instructions ask
  // the user something and pause for a reply (many commands do: /apply's "should
  // I proceed?", /setup's interactive path, /reset's confirmation, etc.) -- there
  // is nothing here yet to answer that. This continues the *same* SDK session
  // with the user's free-text answer as the next prompt, the same mechanism
  // /interview and /outcome already use to resume a company's /apply session,
  // just addressed by this exact run's sessionId instead of a resumeKey lookup.
  "/api/runs/:id/reply": {
    POST: async (req: Request & { params: { id: string } }) => {
      const id = decodeURIComponent(req.params.id);
      const original = await getRun(id);
      if (!original) return errorResponse("run not found", 404);
      if (original.status === "running") {
        return errorResponse("this run is still in progress; wait for it to finish its current turn first");
      }
      if (!original.sessionId) {
        return errorResponse(
          "this run has no session to continue (it may have errored before starting, or never initialized)",
        );
      }
      const body = (await req.json().catch(() => null)) as { message?: string } | null;
      if (!body || typeof body.message !== "string" || !body.message.trim()) {
        return errorResponse("body must be { message: string }");
      }
      const runId = await startRun({
        command: original.command,
        args: body.message.trim(),
        resumeSessionId: original.sessionId,
      });
      return json({ runId }, { status: 201 });
    },
  },
};
