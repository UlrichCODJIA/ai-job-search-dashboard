// Shared Tailwind class constants for form controls and buttons.
//
// These were independently defined (and had already started drifting) across
// several page files -- see the pages listed at each export's usage sites.
// Each constant here is the most complete/correct version among the
// duplicates it replaces (e.g. buttons include `disabled:active:scale-100`).
// Page-specific variants that are genuinely different (not just drift), like
// Settings.tsx's monospace textarea/input classes, stay local to that page.

export const inputClass =
  "rounded-full border border-border/15 bg-surface px-3.5 py-1.5 text-sm text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";

export const textareaClass =
  "rounded-2xl border border-border/15 bg-surface px-3.5 py-2 text-sm text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";

export const primaryButtonClass =
  "rounded-full bg-signal px-3.5 py-1.5 text-xs font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

export const outlineButtonClass =
  "rounded-full border border-border/15 px-3.5 py-1.5 text-xs font-medium text-muted transition-transform hover:border-signal/30 hover:text-signal active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
