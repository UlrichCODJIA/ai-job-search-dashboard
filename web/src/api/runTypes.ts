export type RunStatus = "running" | "completed" | "error" | "stopped";

export interface RunRecord {
  id: string;
  command: string;
  args?: string;
  resumeKey?: string;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  sessionId?: string;
  costUsd?: number;
  error?: string;
  pendingApprovals?: number;
}

// Mirrors dashboard/server/src/ws/hub.ts's emitted event shapes.
export type RunEvent =
  | { type: "run_started"; runId: string; command: string; args?: string }
  | { type: "system_init"; sessionId: string; model: string; tools: string[]; slashCommands: string[] }
  | { type: "assistant_text"; text: string; agentID?: string }
  | { type: "tool_use"; toolUseID: string; toolName: string; input: unknown; agentID?: string }
  | { type: "tool_result"; toolUseID: string; content: string; isError: boolean }
  | { type: "tool_auto_approved"; toolUseID: string; toolName: string; input: unknown; agentID?: string }
  | {
      type: "permission_request";
      toolUseID: string;
      toolName: string;
      input: unknown;
      agentID?: string;
      title?: string;
      decisionReason?: string;
      expiresAt: number;
    }
  | { type: "permission_resolved"; toolUseID: string; approved: boolean }
  | { type: "run_result"; status: "success" | "error"; result?: string; costUsd?: number; durationMs?: number }
  | { type: "run_error"; message: string }
  | { type: "run_stopped" }
  | { type: "sdk_event"; subtype: string; raw: unknown };

// Mirrors dashboard/server/src/routes/runs.ts's KNOWN_COMMANDS -- kept in sync
// by hand since client/server don't share a types package (see architecture
// notes). This list drifting behind the server's is exactly how /reset and
// /notion-sync ended up unreachable from the Runs launcher even after the
// server-side whitelist was expanded to include them.
export const KNOWN_COMMANDS = [
  "/scrape",
  "/rank",
  "/apply",
  "/interview",
  "/outcome",
  "/upskill",
  "/html-report",
  "/expand",
  "/setup",
  "/add-template",
  "/add-portal",
  "/reset",
  "/notion-sync",
] as const;
