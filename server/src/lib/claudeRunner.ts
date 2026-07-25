import { randomUUID } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { cancelPendingApprovalsForRun, emit } from "../ws/hub.js";
import { createPermissionHandler } from "./permissions.js";
import { paths } from "./paths.js";
import { createRun, getSessionForKey, setSessionForKey, updateRun } from "./runStore.js";

export interface StartRunOptions {
  command: string;
  args?: string;
  /** Groups runs on the same application (e.g. a company slug) so a later
   * /interview or /outcome run can resume the session an earlier /apply run left. */
  resumeKey?: string;
  /** Resumes this exact session directly, bypassing the resumeKey lookup. Used
   * by the "reply" flow (routes/runs.ts) to continue a specific run the user is
   * looking at, since a one-shot query() ends its turn the moment the agent's own
   * instructions ask the user a question and there's nothing here yet to answer it -
   * this is how the dashboard sends that answer back into the same conversation. */
  resumeSessionId?: string;
}

// The SDK's assistant/user messages carry Anthropic API content blocks whose full
// types (BetaMessage / MessageParam) are deep; this is the narrow shape this
// module actually reads out of them.
interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

function asContentBlocks(content: unknown): ContentBlock[] {
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

// Seen in the wild when a background Task (subagent) tries to use a
// permission-gated tool after the main turn already emitted its `result`:
// the SDK's own interactive canUseTool channel doesn't survive that, and
// every subsequent gated tool call fails identically, with no
// permission_request ever reaching createPermissionHandler -- our own
// canUseTool callback is never invoked for these, so there's no hook point
// to intercept it earlier than this tool_result content check.
export function isPermissionChannelBrokenError(content: string): boolean {
  return /stream closed/i.test(content);
}

// One AbortController per in-flight run, so a stop request can reach the SDK
// query() that's actually running. Cleared as soon as the run settles either
// way, so a stale entry can never be stopped twice or leak across runs.
const activeControllers = new Map<string, AbortController>();

// Guards against two runs concurrently resuming the *same* SDK session --
// nothing about `query({ resume: sessionId })` is safe to call twice at once
// for one sessionId (e.g. a double-submitted /reply, or a /reply racing an
// /interview or /outcome that resolves the same sessionId via resumeKey).
// activeControllers is keyed by runId, not sessionId, so it can't detect this
// on its own. Checked and set synchronously (no `await` in between) so there's
// no interleaving window between the check and the claim.
const activeResumingSessionIds = new Set<string>();

export async function startRun(opts: StartRunOptions): Promise<string> {
  const runId = randomUUID();
  // A reply continues an existing conversation mid-turn: the raw message IS the
  // prompt. Everywhere else, `command` is a slash command the prompt must lead with.
  const prompt = opts.resumeSessionId ? (opts.args ?? "") : opts.args ? `${opts.command} ${opts.args}` : opts.command;

  await createRun({
    id: runId,
    command: opts.command,
    args: opts.args,
    resumeKey: opts.resumeKey,
    status: "running",
    startedAt: Date.now(),
  });

  emit(runId, { type: "run_started", runId, command: opts.command, args: opts.args });

  // Fire-and-forget: the HTTP handler returns runId immediately; the browser
  // gets everything else by subscribing to /ws/runs/:runId. runQuery() has its
  // own try/catch for SDK errors, but a failure in the catch block itself (e.g.
  // updateRun's file write) would otherwise be a genuine unhandled rejection
  // that can crash the whole Bun.serve() process -- this .catch() is the backstop.
  void runQuery(runId, prompt, opts.resumeKey, opts.resumeSessionId).catch((err) => {
    console.error(`Unhandled error in run ${runId}:`, err);
  });

  return runId;
}

/** Returns false if the run isn't currently active (already finished, or an
 * unknown id) so the route can tell the caller there was nothing to stop. */
export function stopRun(runId: string): boolean {
  const controller = activeControllers.get(runId);
  if (!controller) return false;
  cancelPendingApprovalsForRun(runId, "Run stopped by user.");
  controller.abort();
  return true;
}

async function runQuery(
  runId: string,
  prompt: string,
  resumeKey?: string,
  explicitResumeSessionId?: string,
): Promise<void> {
  const canUseTool = createPermissionHandler(runId);
  const resumeSessionId = explicitResumeSessionId ?? (resumeKey ? await getSessionForKey(resumeKey) : undefined);

  if (resumeSessionId && activeResumingSessionIds.has(resumeSessionId)) {
    emit(runId, {
      type: "run_error",
      message: "This session is already being continued by another run. Wait for it to finish first.",
    });
    await updateRun(runId, {
      status: "error",
      finishedAt: Date.now(),
      error: "session already in use by another run",
    });
    return;
  }
  if (resumeSessionId) activeResumingSessionIds.add(resumeSessionId);

  const abortController = new AbortController();
  activeControllers.set(runId, abortController);
  let sessionId: string | undefined;
  let settled = false;
  // Surfaced once per run as a clear banner instead of the browser seeing the
  // same cryptic tool_result repeat for every remaining gated tool call.
  let permissionChannelBrokenNotified = false;

  try {
    const stream = query({
      prompt,
      options: {
        cwd: paths.repoRoot,
        canUseTool,
        permissionMode: "default",
        abortController,
        ...(resumeSessionId ? { resume: resumeSessionId } : {}),
      },
    });

    for await (const message of stream) {
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
        emit(runId, {
          type: "system_init",
          sessionId,
          model: message.model,
          tools: message.tools,
          slashCommands: message.slash_commands,
        });
        continue;
      }

      if (message.type === "assistant") {
        for (const block of asContentBlocks(message.message?.content)) {
          if (block.type === "text" && block.text) {
            emit(runId, {
              type: "assistant_text",
              text: block.text,
              agentID: message.subagent_type,
            });
          } else if (block.type === "tool_use") {
            emit(runId, {
              type: "tool_use",
              toolUseID: block.id,
              toolName: block.name,
              input: block.input,
              agentID: message.subagent_type,
            });
          }
        }
        continue;
      }

      if (message.type === "user") {
        for (const block of asContentBlocks(message.message?.content)) {
          if (block.type === "tool_result") {
            const content = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
            emit(runId, {
              type: "tool_result",
              toolUseID: block.tool_use_id,
              content,
              isError: Boolean(block.is_error),
            });
            if (block.is_error && !permissionChannelBrokenNotified && isPermissionChannelBrokenError(content)) {
              permissionChannelBrokenNotified = true;
              emit(runId, { type: "permission_channel_broken" });
            }
          }
        }
        continue;
      }

      if (message.type === "result") {
        emit(runId, {
          type: "run_result",
          status: message.is_error ? "error" : "success",
          result: "result" in message ? message.result : undefined,
          costUsd: message.total_cost_usd,
          durationMs: message.duration_ms,
        });
        await updateRun(runId, {
          status: message.is_error ? "error" : "completed",
          finishedAt: Date.now(),
          sessionId,
          costUsd: message.total_cost_usd,
        });
        if (resumeKey && sessionId) {
          await setSessionForKey(resumeKey, sessionId);
        }
        settled = true;
        continue;
      }

      // Every other SDK event (retries, hooks, background tasks, ...) still reaches
      // the browser so nothing is silently swallowed, just not specially formatted.
      emit(runId, { type: "sdk_event", subtype: message.type, raw: message });
    }

    // The SDK may end the stream quietly on abort rather than throwing -- catch
    // that case here so a stopped run doesn't sit at "running" forever.
    if (!settled && abortController.signal.aborted) {
      emit(runId, { type: "run_stopped" });
      await updateRun(runId, { status: "stopped", finishedAt: Date.now(), sessionId });
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      emit(runId, { type: "run_stopped" });
      await updateRun(runId, { status: "stopped", finishedAt: Date.now(), sessionId });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      emit(runId, { type: "run_error", message });
      await updateRun(runId, { status: "error", finishedAt: Date.now(), error: message });
    }
  } finally {
    activeControllers.delete(runId);
    if (resumeSessionId) activeResumingSessionIds.delete(resumeSessionId);
  }
}
