import { useEffect, useMemo, useRef, useState } from "react";
import type { RunEvent } from "../api/runTypes";

export type PendingPermission = Extract<RunEvent, { type: "permission_request" }>;

export function useRunSocket(runId: string | undefined) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!runId) return;
    setEvents([]);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/runs/${runId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as RunEvent;
        setEvents((prev) => [...prev, parsed]);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [runId]);

  const resolvedToolUseIDs = useMemo(
    () => new Set(events.filter((e) => e.type === "permission_resolved").map((e) => e.toolUseID)),
    [events],
  );
  const pendingPermissions: PendingPermission[] = useMemo(
    () =>
      events.filter(
        (e): e is PendingPermission => e.type === "permission_request" && !resolvedToolUseIDs.has(e.toolUseID),
      ),
    [events, resolvedToolUseIDs],
  );

  function respond(toolUseID: string, approved: boolean, message?: string) {
    wsRef.current?.send(JSON.stringify({ type: approved ? "approve" : "deny", toolUseID, message }));
  }

  return { events, connected, pendingPermissions, respond };
}
