import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { emit, requestApproval } from "../ws/hub.js";
import { paths } from "./paths.js";

interface AllowRule {
  tool: string;
  pattern?: string;
}

function parseAllowRule(raw: string): AllowRule | null {
  const match = raw.match(/^([A-Za-z_]+)(?:\((.*)\))?$/);
  if (!match) return null;
  return { tool: match[1], pattern: match[2] };
}

/** Reads the repo's own .claude/settings.json allowlist so the launcher trusts
 * exactly what the terminal CLI would already auto-approve -- nothing wider. */
function loadAllowRules(): AllowRule[] {
  const settingsPath = path.join(paths.repoRoot, ".claude", "settings.json");
  if (!existsSync(settingsPath)) return [];
  try {
    const data = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
      permissions?: { allow?: string[] };
    };
    return (data.permissions?.allow ?? [])
      .map(parseAllowRule)
      .filter((r): r is AllowRule => r !== null);
  } catch {
    return [];
  }
}

function bashCommandMatches(pattern: string, command: string): boolean {
  if (pattern.endsWith(":*")) {
    return command.trim().startsWith(pattern.slice(0, -2).trim());
  }
  return command.trim() === pattern.trim();
}

// Read-only tools are always safe regardless of the allowlist. WebFetch is always
// relayed even when the allowlist would otherwise match: postings are untrusted
// input (SECURITY.md) and the fetched URL isn't known in advance, so there is no
// safe "matches user input" shortcut to auto-approve on.
const ALWAYS_SAFE_TOOLS = new Set(["Read", "Glob", "Grep"]);
const ALWAYS_RELAY_TOOLS = new Set(["WebFetch"]);

function isPreApproved(toolName: string, input: Record<string, unknown>, rules: AllowRule[]): boolean {
  if (ALWAYS_SAFE_TOOLS.has(toolName)) return true;
  if (ALWAYS_RELAY_TOOLS.has(toolName)) return false;

  for (const rule of rules) {
    if (rule.tool !== toolName) continue;
    if (!rule.pattern) return true;
    if (toolName === "Bash" && typeof input.command === "string") {
      if (bashCommandMatches(rule.pattern, input.command)) return true;
    } else if (Object.values(input).some((v) => typeof v === "string" && v === rule.pattern)) {
      return true;
    }
  }
  return false;
}

export interface CanUseToolOptions {
  toolUseID: string;
  agentID?: string;
  title?: string;
  decisionReason?: string;
}

/** Builds this run's canUseTool callback: everything in .claude/settings.json's
 * allowlist (plus Read/Glob/Grep) auto-approves silently; everything else pauses
 * and relays an approve/deny card to the browser over this run's WebSocket. */
export function createPermissionHandler(runId: string) {
  const rules = loadAllowRules();

  return async function canUseTool(
    toolName: string,
    input: Record<string, unknown>,
    options: CanUseToolOptions,
  ): Promise<PermissionResult> {
    if (isPreApproved(toolName, input, rules)) {
      emit(runId, {
        type: "tool_auto_approved",
        toolUseID: options.toolUseID,
        toolName,
        input,
        agentID: options.agentID,
      });
      return { behavior: "allow" };
    }

    emit(runId, {
      type: "permission_request",
      toolUseID: options.toolUseID,
      toolName,
      input,
      agentID: options.agentID,
      title: options.title,
      decisionReason: options.decisionReason,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const decision = await requestApproval(runId, options.toolUseID);

    emit(runId, {
      type: "permission_resolved",
      toolUseID: options.toolUseID,
      approved: decision.approved,
    });

    return decision.approved
      ? { behavior: "allow" }
      : { behavior: "deny", message: decision.message ?? "Denied by user in the AI Job Search dashboard." };
  };
}
