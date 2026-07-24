import { arcPath } from "./arc";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const GAP_DEGREES = 3;

export function Donut({
  segments,
  size = 148,
  thickness = 26,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const visible = segments.filter((s) => s.value > 0);
  let cumulativeAngle = 0;

  const ariaLabel =
    total === 0 ? "No data yet" : segments.map((s) => `${s.value} ${s.label}`).join(", ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel}>
      {total === 0 ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={thickness}
        />
      ) : (
        visible.map((s) => {
          // Cap just short of a full circle: an exact 360deg arc has coincident
          // start/end points and SVG draws nothing for it. A small gap between
          // segments (when there's more than one) reads as a deliberate ring,
          // not a single flat pie -- matches the rounded-arc style dashboards use.
          const gap = visible.length > 1 ? GAP_DEGREES : 0;
          const rawAngle = (s.value / total) * 360;
          const angle = Math.min(Math.max(rawAngle - gap, 0), 359.9);
          const path = arcPath(cx, cy, r, cumulativeAngle, cumulativeAngle + angle);
          cumulativeAngle += rawAngle;
          return (
            <path
              key={s.label}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          );
        })
      )}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.2}
        fontWeight={800}
        className="fill-ink"
      >
        {centerLabel ?? total}
      </text>
    </svg>
  );
}
