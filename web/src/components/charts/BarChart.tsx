import { lighten } from "../../lib/color";

export interface Bar {
  label: string;
  value: number;
  color?: string;
}

export function HorizontalBarChart({
  bars,
  labelWidth = 104,
}: {
  bars: Bar[];
  labelWidth?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ariaLabel =
    bars.map((b) => `${b.label}: ${b.value}`).join(", ") || "No data yet";

  if (bars.length === 0) {
    return <p className="text-sm text-muted">No data yet.</p>;
  }

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-2.5">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2 text-xs">
          <span
            className="shrink-0 truncate text-muted"
            style={{ width: labelWidth }}
            title={b.label}
          >
            {b.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-3 rounded-full transition-all duration-300"
              style={{
                width: `${(b.value / max) * 100}%`,
                background: `linear-gradient(to right, ${b.color ?? "#0891b2"}, ${lighten(b.color ?? "#0891b2")})`,
              }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium text-ink">
            {b.value}
          </span>
        </div>
      ))}
    </div>
  );
}
