import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink">
      {children}
    </h2>
  );
}

export function InlineSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wide text-ink">
      {children}
    </h2>
  );
}
