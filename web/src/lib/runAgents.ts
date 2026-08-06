import type { RunEvent } from "../api/runTypes";

export function countRunningAgents(events: RunEvent[]): number {
  const spawned = new Set<string>();
  const finished = new Set<string>();

  for (const event of events) {
    if (event.type === "tool_use" && event.toolName === "Agent") {
      spawned.add(event.toolUseID);
    } else if (event.type === "tool_result") {
      finished.add(event.toolUseID);
    }
  }

  let running = 0;
  for (const toolUseID of spawned) {
    if (!finished.has(toolUseID)) running += 1;
  }
  return running;
}
