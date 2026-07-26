import { randomUUID } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { cancelPendingApprovalsForRun, emit } from "../ws/hub.js";
import { createPermissionHandler } from "./permissions.js";
import { paths } from "./paths.js";
import {
  createRun,
  getSessionForKey,
  setSessionForKey,
  updateRun,
} from "./runStore.js";

export interface StartRunOptions {
  command: string;
  args?: string;
  resumeKey?: string;
  resumeSessionId?: string;
  threadRootId?: string;
}

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

export function isPermissionChannelBrokenError(content: string): boolean {
  return /stream closed/i.test(content);
}

const activeControllers = new Map<string, AbortController>();

const activeResumingSessionIds = new Set<string>();

export async function startRun(opts: StartRunOptions): Promise<string> {
  const runId = randomUUID();
  const prompt = opts.resumeSessionId
    ? (opts.args ?? "")
    : opts.args
      ? `${opts.command} ${opts.args}`
      : opts.command;

  await createRun({
    id: runId,
    command: opts.command,
    args: opts.args,
    resumeKey: opts.resumeKey,
    status: "running",
    startedAt: Date.now(),
    threadRootId: opts.threadRootId,
  });

  emit(runId, {
    type: "run_started",
    runId,
    command: opts.command,
    args: opts.args,
  });

  void runQuery(runId, prompt, opts.resumeKey, opts.resumeSessionId).catch(
    (err) => {
      console.error(`Unhandled error in run ${runId}:`, err);
    },
  );

  return runId;
}

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
  const resumeSessionId =
    explicitResumeSessionId ??
    (resumeKey ? await getSessionForKey(resumeKey) : undefined);

  if (resumeSessionId && activeResumingSessionIds.has(resumeSessionId)) {
    emit(runId, {
      type: "run_error",
      message:
        "This session is already being continued by another run. Wait for it to finish first.",
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
            const content =
              typeof block.content === "string"
                ? block.content
                : JSON.stringify(block.content);
            emit(runId, {
              type: "tool_result",
              toolUseID: block.tool_use_id,
              content,
              isError: Boolean(block.is_error),
            });
            if (
              block.is_error &&
              !permissionChannelBrokenNotified &&
              isPermissionChannelBrokenError(content)
            ) {
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

      emit(runId, { type: "sdk_event", subtype: message.type, raw: message });
    }

    if (!settled && abortController.signal.aborted) {
      emit(runId, { type: "run_stopped" });
      await updateRun(runId, {
        status: "stopped",
        finishedAt: Date.now(),
        sessionId,
      });
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      emit(runId, { type: "run_stopped" });
      await updateRun(runId, {
        status: "stopped",
        finishedAt: Date.now(),
        sessionId,
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      emit(runId, { type: "run_error", message });
      await updateRun(runId, {
        status: "error",
        finishedAt: Date.now(),
        error: message,
      });
    }
  } finally {
    activeControllers.delete(runId);
    if (resumeSessionId) activeResumingSessionIds.delete(resumeSessionId);
  }
}
