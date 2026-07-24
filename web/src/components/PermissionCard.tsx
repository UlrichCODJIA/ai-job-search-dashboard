import type { PendingPermission } from "../hooks/useRunSocket";

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  return Object.entries(input as Record<string, unknown>)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}

export function PermissionCard({
  permission,
  onRespond,
}: {
  permission: PendingPermission;
  onRespond: (approved: boolean) => void;
}) {
  const summary = summarizeInput(permission.input);
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-500">
          <span aria-hidden>⏸</span>
          {permission.title ?? `Wants to use ${permission.toolName}`}
        </p>
        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-500">
          Needs approval
        </span>
      </div>
      {permission.decisionReason && (
        <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-500/80">{permission.decisionReason}</p>
      )}
      {summary && (
        <p className="mt-1 truncate font-mono text-xs text-amber-700/70 dark:text-amber-500/70" title={summary}>
          {summary}
        </p>
      )}
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => onRespond(true)}
          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white transition-transform hover:bg-emerald-600 active:scale-[0.97]"
        >
          Approve
        </button>
        <button
          onClick={() => onRespond(false)}
          className="rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white transition-transform hover:bg-red-600 active:scale-[0.97]"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
