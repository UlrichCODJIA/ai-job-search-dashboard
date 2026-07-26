import { useId, useMemo } from "react";
import { lighten } from "../../lib/color";
import type { ActivityDay } from "../../lib/activity";

const VIEW_WIDTH = 280;

const VERTICAL_BUFFER_RATIO = 0.22;

export function AreaChart({
  data,
  color = "#0891b2",
  height = 72,
  className,
}: {
  data: ActivityDay[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
  const buffer = height * VERTICAL_BUFFER_RATIO;

  const { linePath, areaPath, hasSignal } = useMemo(() => {
    if (data.length === 0)
      return { linePath: "", areaPath: "", hasSignal: false };
    const max = Math.max(1, ...data.map((d) => d.count));
    const n = data.length;
    const stepX = n > 1 ? VIEW_WIDTH / (n - 1) : VIEW_WIDTH;
    const points = data.map((d, i) => ({
      x: i * stepX,
      y: height - (d.count / max) * (height - 6) - 3,
    }));
    const line = buildSmoothPath(points);
    const last = points[points.length - 1];
    const area = `${line} L ${last.x} ${height} L ${points[0].x} ${height} Z`;
    return {
      linePath: line,
      areaPath: area,
      hasSignal: data.some((d) => d.count > 0),
    };
  }, [data, height]);

  if (!linePath) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        No activity yet
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 ${-buffer} ${VIEW_WIDTH} ${height + buffer * 2}`}
      preserveAspectRatio="none"
      className={className ?? "h-full w-full"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={color}
            stopOpacity={hasSignal ? 0.35 : 0.06}
          />
          <stop
            offset="55%"
            stopColor={lighten(color)}
            stopOpacity={hasSignal ? 0.14 : 0.03}
          />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) {
    const p = points[0];
    return p ? `M ${p.x} ${p.y} L ${p.x} ${p.y}` : "";
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
