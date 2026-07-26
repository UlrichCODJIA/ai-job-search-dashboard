import { useEffect, useRef, useState } from "react";
import type { ActivityDay } from "../../lib/activity";

const CELL_PX = 16;
const GAP_PX = 4;
const COLUMN_PITCH = CELL_PX + GAP_PX;

export function ActivityHeatmap({
  days,
  onVisibleDaysChange,
}: {
  days: ActivityDay[];
  onVisibleDaysChange?: (count: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(9);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const fit = Math.max(
        1,
        Math.floor((el.clientWidth + GAP_PX) / COLUMN_PITCH),
      );
      setColumns(fit);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxColumns = Math.max(1, Math.ceil(days.length / 7));
  const visibleColumns = Math.min(columns, maxColumns);
  const visibleDays = days.slice(-visibleColumns * 7);

  useEffect(() => {
    onVisibleDaysChange?.(visibleDays.length);
  }, [visibleDays.length, onVisibleDaysChange]);

  const max = Math.max(1, ...visibleDays.map((d) => d.count));
  const ariaLabel = `Scrape activity over the last ${visibleDays.length} days, ${visibleDays.reduce((s, d) => s + d.count, 0)} postings total`;

  return (
    <div ref={containerRef} className="w-full">
      <div
        role="img"
        aria-label={ariaLabel}
        className="animate-heatmap-in grid grid-flow-col grid-rows-7 gap-1"
      >
        {visibleDays.map((d) => {
          const intensity = d.count === 0 ? 0.08 : 0.3 + (d.count / max) * 0.7;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} posting${d.count === 1 ? "" : "s"}`}
              className="h-4 w-4 rounded"
              style={{
                backgroundColor: `rgb(var(--color-signal) / ${intensity})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
