export function TrendIndicator({ direction, label }: { direction: "up" | "down" | "flat"; label: string }) {
  if (direction === "flat") return <span className="text-xs text-muted">{label}</span>;
  const isUp = direction === "up";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-500" : "text-rose-500"}`}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" className={isUp ? "" : "rotate-180"}>
        <path d="M4 0 L8 8 L0 8 Z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
