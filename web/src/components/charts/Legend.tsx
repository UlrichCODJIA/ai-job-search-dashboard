export interface LegendItem {
  label: string;
  value: number;
  color: string;
}

export function Legend({
  items,
  layout = "list",
}: {
  items: LegendItem[];
  layout?: "list" | "chips";
}) {
  if (layout === "chips") {
    return (
      <ul className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 px-3 py-1">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted">{item.label}</span>
            <span className="font-bold text-ink">{item.value}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-1 flex-col gap-1.5 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted">{item.label}</span>
          <span className="ml-auto font-bold text-ink">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
