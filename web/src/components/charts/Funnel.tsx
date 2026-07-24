export interface FunnelStage {
  label: string;
  value: number;
}

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const first = stages[0]?.value ?? 0;
  const ariaLabel = stages.map((s) => `${s.label}: ${s.value}`).join(" then ") || "No data yet";

  if (stages.length === 0) {
    return <p className="text-sm text-muted">No data yet.</p>;
  }

  return (
    <div role="img" aria-label={`Application funnel: ${ariaLabel}`} className="flex flex-col gap-2.5">
      {stages.map((s) => {
        const pctOfMax = (s.value / max) * 100;
        const pctOfFirst = first > 0 ? Math.round((s.value / first) * 100) : 0;
        return (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate text-muted">{s.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2">
              <div
                className="h-4 rounded bg-signal transition-all duration-300"
                style={{ width: `${pctOfMax}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-ink">
              {s.value} ({pctOfFirst}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}
