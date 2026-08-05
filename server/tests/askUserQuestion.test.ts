import { describe, expect, test } from "bun:test";
import {
  cancelPendingApprovalsForRun,
  getPendingApprovalCount,
  requestQuestionAnswer,
  resolveQuestionAnswer,
  resolveQuestionSkip,
} from "../src/ws/hub.js";

function testRunId(suffix: string): string {
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

describe("AskUserQuestion answer channel", () => {
  test("resolveQuestionAnswer delivers the answers to the pending request", async () => {
    const runId = testRunId("1");
    const toolUseID = "tool-1";
    const pending = requestQuestionAnswer(runId, toolUseID);

    expect(resolveQuestionAnswer(runId, toolUseID, { "Pick one": "A" })).toBe(true);

    const decision = await pending;
    expect(decision).toEqual({ answered: true, answers: { "Pick one": "A" } });
  });

  test("resolveQuestionSkip delivers an unanswered decision with a message", async () => {
    const runId = testRunId("2");
    const toolUseID = "tool-1";
    const pending = requestQuestionAnswer(runId, toolUseID);

    expect(resolveQuestionSkip(runId, toolUseID, "User skipped")).toBe(true);

    const decision = await pending;
    expect(decision).toEqual({ answered: false, message: "User skipped" });
  });

  test("resolving twice is a no-op the second time", () => {
    const runId = testRunId("3");
    const toolUseID = "tool-1";
    requestQuestionAnswer(runId, toolUseID);

    expect(resolveQuestionAnswer(runId, toolUseID, { q: "a" })).toBe(true);
    expect(resolveQuestionAnswer(runId, toolUseID, { q: "b" })).toBe(false);
    expect(resolveQuestionSkip(runId, toolUseID)).toBe(false);
  });

  test("resolving an unknown toolUseID is a no-op", () => {
    const runId = testRunId("4");
    expect(resolveQuestionAnswer(runId, "nonexistent", { q: "a" })).toBe(false);
    expect(resolveQuestionSkip(runId, "nonexistent")).toBe(false);
  });

  test("getPendingApprovalCount includes pending questions and drops to 0 once resolved", () => {
    const runId = testRunId("5");
    expect(getPendingApprovalCount(runId)).toBe(0);

    requestQuestionAnswer(runId, "tool-a");
    requestQuestionAnswer(runId, "tool-b");
    expect(getPendingApprovalCount(runId)).toBe(2);

    resolveQuestionAnswer(runId, "tool-a", { q: "a" });
    expect(getPendingApprovalCount(runId)).toBe(1);

    resolveQuestionSkip(runId, "tool-b");
    expect(getPendingApprovalCount(runId)).toBe(0);
  });

  test("cancelPendingApprovalsForRun resolves outstanding questions as unanswered", async () => {
    const runId = testRunId("6");
    const pending = requestQuestionAnswer(runId, "tool-a");

    cancelPendingApprovalsForRun(runId, "Run stopped by user.");

    const decision = await pending;
    expect(decision).toEqual({ answered: false, message: "Run stopped by user." });
    expect(getPendingApprovalCount(runId)).toBe(0);
  });

  test("cancelPendingApprovalsForRun only affects the given run's questions", async () => {
    const runIdA = testRunId("7");
    const runIdB = testRunId("8");
    const pendingA = requestQuestionAnswer(runIdA, "tool-a");
    requestQuestionAnswer(runIdB, "tool-b");

    cancelPendingApprovalsForRun(runIdA, "stopped");

    await pendingA;
    expect(getPendingApprovalCount(runIdA)).toBe(0);
    expect(getPendingApprovalCount(runIdB)).toBe(1);

    resolveQuestionSkip(runIdB, "tool-b");
  });
});
