export type RunStatus = "running" | "completed" | "error" | "stopped";

export type RunPermissionMode = "default" | "acceptEdits";

export interface AskUserQuestionOption {
  label: string;
  description: string;
  preview?: string;
}

export interface AskUserQuestionItem {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
}

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
  threadRootId?: string;
  resumeFailed?: boolean;
  permissionMode?: RunPermissionMode;
}

export type RunEvent =
  | { type: "run_started"; runId: string; command: string; args?: string }
  | {
      type: "system_init";
      sessionId: string;
      model: string;
      tools: string[];
      slashCommands: string[];
    }
  | { type: "assistant_text"; text: string; agentID?: string }
  | {
      type: "tool_use";
      toolUseID: string;
      toolName: string;
      input: unknown;
      agentID?: string;
    }
  | {
      type: "tool_result";
      toolUseID: string;
      content: string;
      isError: boolean;
    }
  | {
      type: "tool_auto_approved";
      toolUseID: string;
      toolName: string;
      input: unknown;
      agentID?: string;
    }
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
  | {
      type: "question_request";
      toolUseID: string;
      questions: AskUserQuestionItem[];
      agentID?: string;
      expiresAt: number;
    }
  | { type: "question_resolved"; toolUseID: string; answered: boolean }
  | {
      type: "run_result";
      status: "success" | "error";
      result?: string;
      costUsd?: number;
      durationMs?: number;
    }
  | { type: "run_error"; message: string }
  | { type: "run_stopped" }
  | { type: "permission_channel_broken" }
  | { type: "resume_failed"; requestedSessionId: string; actualSessionId: string }
  | { type: "sdk_event"; subtype: string; raw: unknown }
  | { type: "thread_reply"; message: string; repliedAt: number };

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
