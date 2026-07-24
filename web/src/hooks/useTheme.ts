import { useCallback, useSyncExternalStore } from "react";

type Theme = "dark" | "light";
// Bumped from ":theme" -- the old key was written on every mount (not just on
// an explicit toggle), so it can't be trusted to represent a real user choice
// versus a computed default. Renaming orphans any stale auto-written value
// instead of silently honoring it as if someone had deliberately picked dark.
const STORAGE_KEY = "mission-control:theme:v2";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

// The DOM class is the single source of truth (index.html's blocking inline
// script already sets it before React mounts, avoiding a flash of the wrong
// theme). Reading it directly here -- rather than each component keeping its
// own useState -- means every component calling useTheme() re-renders
// together when *any* of them toggles, instead of only the one that owns the
// button staying in sync.
function getSnapshot(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    applyTheme(next);
    // Only an explicit toggle persists -- never write on mount, or the
    // stored value stops meaning "the user chose this" (see STORAGE_KEY).
    localStorage.setItem(STORAGE_KEY, next);
    for (const listener of listeners) listener();
  }, []);

  return { theme, toggle };
}
