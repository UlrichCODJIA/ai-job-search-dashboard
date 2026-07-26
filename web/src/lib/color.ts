export function shadeForText(
  hex: string,
  theme: "light" | "dark",
  amount = 0.42,
): string {
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

export function lighten(hex: string, amount = 0.4): string {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const tint = (channel: number) =>
    Math.round(channel + (255 - channel) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${tint(r)}${tint(g)}${tint(b)}`;
}
