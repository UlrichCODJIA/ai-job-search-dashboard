import { useEffect, useRef } from "react";
import type { RunEvent } from "../api/runTypes";

function formatInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

export function RunLogViewer({ events }: { events: RunEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  return (
    <div className="thin-scrollbar flex max-h-[28rem] flex-col gap-1 overflow-y-auto rounded-2xl border border-white/5 bg-[#08090d] p-3 font-mono text-xs">
      {events.length === 0 && <p className="text-slate-500">Waiting for output...</p>}
      {events.map((event, i) => {
        switch (event.type) {
          case "system_init":
            return (
              <p key={i} className="text-slate-500">
                session {event.sessionId.slice(0, 8)} · model {event.model}
              </p>
            );
          case "assistant_text":
            return (
              <p key={i} className="whitespace-pre-wrap text-slate-200">
                {event.text}
              </p>
            );
          case "tool_use":
            return (
              <p key={i} className="text-cyan-400">
                ▸ {event.toolName}({formatInput(event.input).slice(0, 200)})
              </p>
            );
          case "tool_auto_approved":
            return (
              <p key={i} className="text-slate-600">
                ✓ auto-approved {event.toolName}
              </p>
            );
          case "tool_result":
            return (
              <p key={i} className={event.isError ? "pl-4 text-red-400" : "pl-4 text-slate-500"}>
                {event.content.slice(0, 300)}
              </p>
            );
          case "permission_request":
            return (
              <p key={i} className="text-amber-400">
                ⏸ waiting for approval: {event.toolName}
              </p>
            );
          case "permission_resolved":
            return (
              <p key={i} className={event.approved ? "text-emerald-400" : "text-red-400"}>
                {event.approved ? "✓ approved" : "✗ denied"}
              </p>
            );
          case "run_result":
            return (
              <p key={i} className={event.status === "success" ? "text-emerald-400" : "text-red-400"}>
                ● run {event.status}
                {event.durationMs ? ` · ${Math.round(event.durationMs / 1000)}s` : ""}
                {event.costUsd != null ? ` · $${event.costUsd.toFixed(3)}` : ""}
              </p>
            );
          case "run_error":
            return (
              <p key={i} className="text-red-400">
                ✗ {event.message}
              </p>
            );
          case "run_stopped":
            return (
              <p key={i} className="text-amber-400">
                ■ stopped by user
              </p>
            );
          case "thread_reply":
            return (
              <div key={i} className="my-1 border-t border-white/10 pt-2 text-slate-400">
                <span className="text-signal">↳ you replied:</span>{" "}
                <span className="whitespace-pre-wrap">{event.message}</span>
              </div>
            );
          case "permission_channel_broken":
            return (
              <p key={i} className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-red-300">
                ⚠ This run's tool-approval channel has stopped responding -- every write/edit/fetch from here on
                will keep failing the same way. Retrying in place won't help; start a fresh continuation instead
                (reply "continue" once this run settles, or relaunch the command).
              </p>
            );
          default:
            return null;
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
