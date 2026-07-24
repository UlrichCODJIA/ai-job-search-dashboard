import type { Config } from "tailwindcss";

// Semantic tokens backed by CSS variables (styles/index.css) so light/dark
// swap by flipping the variables, not by sprinkling `dark:` everywhere.
function cssVar(name: string): string {
  return `rgb(var(${name}) / <alpha-value>)`;
}

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: cssVar("--color-base"),
        surface: cssVar("--color-surface"),
        "surface-2": cssVar("--color-surface-2"),
        border: cssVar("--color-border"),
        ink: cssVar("--color-ink"),
        muted: cssVar("--color-muted"),
        signal: cssVar("--color-signal"),
        "signal-ink": cssVar("--color-signal-ink"),
        status: {
          active: "#0891b2",
          interview: "#f59e0b",
          offer: "#8b5cf6",
          hired: "#22c55e",
          closed: "#ef4444",
        },
        fit: {
          strong: "#22c55e",
          good: "#84cc16",
          moderate: "#f59e0b",
          weak: "#f97316",
          poor: "#ef4444",
        },
      },
      fontFamily: {
        // Real reference dashboards (Linear, PostHog, Sentry, QuartRevenue,
        // InsightStream) all use bold/confident sans for headlines and
        // numerals, never serif -- a data/control tool reads as utility, not
        // editorial. Hierarchy comes from weight, size, and tracking instead.
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--color-signal) / 0.15), 0 8px 28px -8px rgb(var(--color-signal) / 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
