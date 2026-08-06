import clsx from "clsx";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  accent,
  hint,
  variant = "default",
  align = "left",
  onClick,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: string;
  variant?: "default" | "hero";
  align?: "left" | "center";
  onClick?: () => void;
}) {
  const tint = accent ?? "#0891b2";

  if (variant === "hero") {
    return (
      <div
        className="relative flex h-full flex-col gap-1 overflow-hidden rounded-3xl px-4 py-3.5 text-white shadow-glow"
        style={{ backgroundColor: tint }}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-white/75">
          {label}
        </span>
        <span className="text-3xl font-extrabold tracking-tight text-white">
          {value}
        </span>
        {hint && (
          <span className="text-xs font-medium text-white/75">{hint}</span>
        )}
      </div>
    );
  }

  const className = clsx(
    "group relative flex h-full flex-col gap-1 overflow-hidden rounded-3xl px-4 py-3.5 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow",
    align === "center" && "items-center text-center lg:items-start lg:text-left",
    onClick && "cursor-pointer text-left",
  );
  const content = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
        {label}
      </span>
      <span className="text-3xl font-extrabold tracking-tight tabular-nums text-white">
        {value}
      </span>
      {hint && <span className="text-xs text-white/80">{hint}</span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={{ backgroundColor: tint }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={{ backgroundColor: tint }}>
      {content}
    </div>
  );
}
