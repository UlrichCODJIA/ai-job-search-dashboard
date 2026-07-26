import { useEffect, useId, useState } from "react";
import { arcPath } from "./arc";
import { lighten } from "../../lib/color";

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
  const baseId = useId();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const visible = segments.filter((s) => s.value > 0);
  let cumulativeAngle = 0;

  const ariaLabel =
    total === 0
      ? "No data yet"
      : segments.map((s) => `${s.value} ${s.label}`).join(", ");

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
    >
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
        visible.map((s, i) => {
          const gap = visible.length > 1 ? GAP_DEGREES : 0;
          const rawAngle = (s.value / total) * 360;
          const angle = Math.min(Math.max(rawAngle - gap, 0), 359.9);
          const path = arcPath(
            cx,
            cy,
            r,
            cumulativeAngle,
            cumulativeAngle + angle,
          );
          cumulativeAngle += rawAngle;
          const arcLength = (r * angle * Math.PI) / 180;
          const gradientId = `${baseId}-${i}`;
          return (
            <g key={s.label}>
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={s.color} />
                  <stop offset="100%" stopColor={lighten(s.color)} />
                </linearGradient>
              </defs>
              <path
                d={path}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={arcLength}
                strokeDashoffset={drawn ? 0 : arcLength}
                style={{
                  transition: "stroke-dashoffset 0.6s ease-out",
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            </g>
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
