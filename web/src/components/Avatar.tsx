import { useTheme } from "../hooks/useTheme";
import { shadeForText } from "../lib/color";

// Deterministic color-by-name initial badge -- small personality touch for
// rows of companies/people (QuartRevenue's customer list, Health Dashboard's
// patient list both use avatars instead of plain text to humanize dense data).
const PALETTE = [
  "#0891b2",
  "#f59e0b",
  "#8b5cf6",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#6366f1",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { theme } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const color = PALETTE[hashString(name) % PALETTE.length];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}22`,
        color: shadeForText(color, theme),
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
