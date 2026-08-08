import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths, realPaths } from "./helpers/mockPaths.js";

const { createPermissionHandler } = await import("../src/lib/permissions.js");
const {
  getEventLog,
  getPendingApprovalCount,
  resolveApproval,
  resolveQuestionAnswer,
  resolveQuestionSkip,
} = await import("../src/ws/hub.js");

function logFilePath(runId: string): string {
  return path.join(realPaths.runLogsDir, `${runId}.jsonl`);
}

function testRunId(suffix: string): string {
  const id = `00000000-0000-4000-9000-${suffix.padStart(12, "0")}`;
  rmSync(logFilePath(id), { force: true });
  return id;
}

let testDir: string;

function writeAllowRules(rules: string[]): void {
  mkdirSync(path.join(testDir, ".claude"), { recursive: true });
  writeFileSync(
    path.join(testDir, ".claude", "settings.json"),
    JSON.stringify({ permissions: { allow: rules } }),
    "utf-8",
  );
}

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "permissions-test-"));
  mockPaths.repoRoot = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("canUseTool -- always-safe and always-relay tools", () => {
  test("Read/Glob/Grep auto-approve with no allow-list and never touch the approval channel", async () => {
    const runId = testRunId("1");
    const canUseTool = createPermissionHandler(runId);

    for (const toolName of ["Read", "Glob", "Grep"]) {
      const result = await canUseTool(toolName, { file_path: "x" }, { toolUseID: `tu-${toolName}` });
      expect(result).toEqual({ behavior: "allow" });
    }

    expect(getPendingApprovalCount(runId)).toBe(0);
    const events = getEventLog(runId);
    expect(events.filter((e) => e.type === "tool_auto_approved")).toHaveLength(3);
    expect(events.some((e) => e.type === "permission_request")).toBe(false);
  });

  test("WebFetch never auto-approves, even with a matching allow-list rule", async () => {
    writeAllowRules(["WebFetch"]);
    const runId = testRunId("2");
    const canUseTool = createPermissionHandler(runId);

    const pending = canUseTool("WebFetch", { url: "https://example.com" }, { toolUseID: "tu-1" });
    expect(getPendingApprovalCount(runId)).toBe(1);
    resolveApproval(runId, "tu-1", true);

    expect(await pending).toEqual({ behavior: "allow" });
    const events = getEventLog(runId);
    expect(events.some((e) => e.type === "permission_request")).toBe(true);
    expect(events.some((e) => e.type === "tool_auto_approved")).toBe(false);
  });
});

describe("canUseTool -- allow-list matching", () => {
  test("Bash: an exact-match pattern auto-approves the identical command only", async () => {
    writeAllowRules(["Bash(bun test)"]);
    const runId = testRunId("3");
    const canUseTool = createPermissionHandler(runId);

    const matching = await canUseTool("Bash", { command: "bun test" }, { toolUseID: "tu-1" });
    expect(matching).toEqual({ behavior: "allow" });

    const pending = canUseTool("Bash", { command: "bun test --watch" }, { toolUseID: "tu-2" });
    expect(getPendingApprovalCount(runId)).toBe(1);
    resolveApproval(runId, "tu-2", false, "not the exact command");
    expect(await pending).toEqual({ behavior: "deny", message: "not the exact command" });
  });

  test("Bash: a trailing ':*' pattern auto-approves any command sharing that prefix", async () => {
    writeAllowRules(["Bash(bun run:*)"]);
    const runId = testRunId("4");
    const canUseTool = createPermissionHandler(runId);

    const result = await canUseTool("Bash", { command: "bun run build" }, { toolUseID: "tu-1" });
    expect(result).toEqual({ behavior: "allow" });
  });

  test("Edit: a trailing '*' path pattern auto-approves any nested path, not a sibling", async () => {
    writeAllowRules(["Edit(documents/applications/*)"]);
    const runId = testRunId("5");
    const canUseTool = createPermissionHandler(runId);

    const nested = await canUseTool(
      "Edit",
      { file_path: path.join(testDir, "documents/applications/acme_swe/outcome.md") },
      { toolUseID: "tu-1" },
    );
    expect(nested).toEqual({ behavior: "allow" });

    const sibling = canUseTool(
      "Edit",
      { file_path: path.join(testDir, "documents/other/file.md") },
      { toolUseID: "tu-2" },
    );
    expect(getPendingApprovalCount(runId)).toBe(1);
    resolveApproval(runId, "tu-2", true);
    expect(await sibling).toEqual({ behavior: "allow" });
  });

  test("a tool with no rule at all goes through the approval channel and honors approve/deny", async () => {
    const runId = testRunId("6");
    const canUseTool = createPermissionHandler(runId);

    const approved = canUseTool("Write", { file_path: "notes.md" }, { toolUseID: "tu-1" });
    expect(getPendingApprovalCount(runId)).toBe(1);
    resolveApproval(runId, "tu-1", true);
    expect(await approved).toEqual({ behavior: "allow" });

    const denied = canUseTool("Write", { file_path: "notes2.md" }, { toolUseID: "tu-2" });
    resolveApproval(runId, "tu-2", false);
    expect(await denied).toEqual({
      behavior: "deny",
      message: "Denied by user in the AI Job Search dashboard.",
    });
  });
});

describe("canUseTool -- AskUserQuestion special-case", () => {
  test("routes to the question channel, not the generic approval channel, and returns answers on allow", async () => {
    const runId = testRunId("7");
    const canUseTool = createPermissionHandler(runId);
    const questions = [{ question: "Pick one", header: "Choice", options: [{ label: "A", description: "" }] }];

    const pending = canUseTool("AskUserQuestion", { questions }, { toolUseID: "tu-1" });
    expect(getPendingApprovalCount(runId)).toBe(1);

    const events = getEventLog(runId);
    expect(events.some((e) => e.type === "question_request")).toBe(true);
    expect(events.some((e) => e.type === "permission_request")).toBe(false);

    resolveQuestionAnswer(runId, "tu-1", { Choice: "A" });
    expect(await pending).toEqual({
      behavior: "allow",
      updatedInput: { questions, answers: { Choice: "A" } },
    });
  });

  test("a skipped question denies with the default message when none is given", async () => {
    const runId = testRunId("8");
    const canUseTool = createPermissionHandler(runId);

    const pending = canUseTool("AskUserQuestion", { questions: [] }, { toolUseID: "tu-1" });
    resolveQuestionSkip(runId, "tu-1");
    expect(await pending).toEqual({
      behavior: "deny",
      message: "Skipped by user in the AI Job Search dashboard.",
    });
  });
});
