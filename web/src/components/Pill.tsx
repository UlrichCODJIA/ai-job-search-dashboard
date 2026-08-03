import clsx from "clsx";
import type { ReactNode } from "react";
import type { StatusBucket } from "../api/types";
import { useTheme } from "../hooks/useTheme";
import { shadeForText } from "../lib/color";

const STATUS_COLORS: Record<StatusBucket, string> = {
  Drafted: "#6366f1",
  Active: "#0891b2",
  Interview: "#f59e0b",
  Offer: "#8b5cf6",
  Hired: "#22c55e",
  "Rejected/Closed": "#E11D48",
};

const FIT_COLORS: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
  "strong fit": "#22c55e",
  "good fit": "#84cc16",
  "moderate fit": "#f59e0b",
  "weak fit": "#f97316",
  "poor fit": "#ef4444",
  excluded: "#64748b",
};

export function Pill({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}1a`,
        color: shadeForText(color, theme),
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </span>
  );
}

export function FitPill({ fit }: { fit: string }) {
  const color = FIT_COLORS[fit.trim().toLowerCase()] ?? "#64748b";
  return <Pill color={color}>{fit}</Pill>;
}

export function NeutralPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export { STATUS_COLORS, FIT_COLORS };
