import { useId } from "react";
import { arcPath } from "./arc";

// Single-value arc gauge (QuartRevenue's "Quarter goal 84%", InsightStream's
// "User today" ring) -- reads as a KPI-against-target, not a category breakdown
// like Donut. Deliberately capped short of a full circle per segment; see arc.ts.
// The untouched track uses a diagonal-hatch fill rather than flat gray -- the
// solid-vs-hatched "achieved vs. remaining" motif shows up repeatedly across
// the reference library (Vaulto's balance ring, Donezo's project rings).
export function ProgressRing({
  value,
  size = 116,
  thickness = 12,
  color = "#0891b2",
  label,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
}) {
  const patternId = `ring-hatch-${useId()}`;
  const clamped = Math.max(0, Math.min(100, value));
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const angle = Math.min((clamped / 100) * 360, 359.9);
  const path = angle > 0 ? arcPath(cx, cy, r, 0, angle) : null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`${label ?? "Progress"}: ${Math.round(clamped)}%`}
    >
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" className="fill-surface-2" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="5"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="2"
          />
        </pattern>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={`url(#${patternId})`}
        strokeWidth={thickness}
        className="text-muted"
      />
      {path && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
      )}
      <text
        x={cx}
        y={label ? cy - size * 0.06 : cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.22}
        fontWeight={800}
        className="fill-ink"
      >
        {Math.round(clamped)}%
      </text>
      {label && (
        <text
          x={cx}
          y={cy + size * 0.18}
          textAnchor="middle"
          fontSize={size * 0.09}
          className="fill-muted"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
