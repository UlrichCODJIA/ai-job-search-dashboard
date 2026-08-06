import { describe, expect, test } from "bun:test";
import { countRunningAgents } from "./runAgents";
import type { RunEvent } from "../api/runTypes";

function agentSpawn(toolUseID: string): RunEvent {
  return { type: "tool_use", toolUseID, toolName: "Agent", input: {} };
}

function agentResult(toolUseID: string): RunEvent {
  return { type: "tool_result", toolUseID, content: "done", isError: false };
}

describe("countRunningAgents", () => {
  test("returns 0 for an empty event list", () => {
    expect(countRunningAgents([])).toBe(0);
  });

  test("returns 0 when no Agent tool has been spawned", () => {
    const events: RunEvent[] = [
      { type: "assistant_text", text: "hello" },
      { type: "tool_use", toolUseID: "t1", toolName: "Bash", input: { command: "ls" } },
      agentResult("t1"),
    ];
    expect(countRunningAgents(events)).toBe(0);
  });

  test("counts a spawned agent with no matching result as still running", () => {
    const events: RunEvent[] = [agentSpawn("a1")];
    expect(countRunningAgents(events)).toBe(1);
  });

  test("does not count an agent once its tool_result arrives", () => {
    const events: RunEvent[] = [agentSpawn("a1"), agentResult("a1")];
    expect(countRunningAgents(events)).toBe(0);
  });

  test("counts multiple parallel agents independently", () => {
    const events: RunEvent[] = [
      agentSpawn("a1"),
      agentSpawn("a2"),
      agentSpawn("a3"),
      agentResult("a2"),
    ];
    expect(countRunningAgents(events)).toBe(2);
  });

  test("ignores tool_result events for non-Agent tools", () => {
    const events: RunEvent[] = [
      agentSpawn("a1"),
      { type: "tool_use", toolUseID: "b1", toolName: "Bash", input: { command: "ls" } },
      agentResult("b1"),
    ];
    expect(countRunningAgents(events)).toBe(1);
  });
});
