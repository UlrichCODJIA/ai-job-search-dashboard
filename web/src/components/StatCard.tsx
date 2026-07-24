import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import { shadeForText } from "../lib/color";

export function StatCard({
  label,
  value,
  accent,
  hint,
  variant = "default",
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: string;
  /** "hero" gives this one card a solid accent fill so it reads as the
   * featured metric among neutral cards -- the pattern real dashboards
   * (Health Dashboard's "Patients" card) use for visual hierarchy instead of
   * making every tile look identical. */
  variant?: "default" | "hero";
}) {
  // A literal hex fallback, not the CSS-var reference: both this and the
  // default-variant tint below build translucent shades by appending an alpha
  // suffix to `accent`, which only works for actual hex strings. Brand/status
  // accents are intentionally theme-constant (like STATUS_COLORS) rather than
  // flipping with light/dark -- unlike surface/text tokens, a semantic color
  // should stay recognizable across themes.
  const tint = accent ?? "#0891b2";
  const { theme } = useTheme();

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

  return (
    <div
      className="group relative flex h-full flex-col gap-1 overflow-hidden rounded-3xl border px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow"
      style={{ backgroundColor: `${tint}14`, borderColor: `${tint}33` }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: shadeForText(tint, theme) }}
      >
        {label}
      </span>
      <span className="text-3xl font-extrabold tracking-tight tabular-nums text-ink">
        {value}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
