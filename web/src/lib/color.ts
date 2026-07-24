/** Brand/status/fit colors (STATUS_COLORS, FIT_COLORS, StatCard accents) were
 * tuned to sit on the dark theme's near-black surfaces, where a bright, fully
 * saturated hex reads clearly as text. On the light theme's near-white
 * surfaces the same bright hex is low-contrast (this is the same root cause
 * as the earlier bg-signal/text-signal-ink issue, just for a different set of
 * colors) -- so text specifically needs a shaded-toward-black variant, while
 * dots/background tints can keep the original vivid color. */
export function shadeForText(hex: string, theme: "light" | "dark", amount = 0.42): string {
  if (theme === "dark") return hex;
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const shade = (channel: number) =>
    Math.round(channel * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${shade(r)}${shade(g)}${shade(b)}`;
}
