import clsx from "clsx";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronLeftIcon, PlusIcon } from "../icons";
import { RAIL_NAV_ITEMS } from "./navItems";

const STORAGE_KEY = "dashboard:iconRailExpanded";

function readStoredExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function IconRail() {
  const [expanded, setExpanded] = useState(readStoredExpanded);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  return (
    <aside
      className={clsx(
        "hidden shrink-0 flex-col border border-border/10 bg-surface py-4 shadow-sm transition-all duration-200 lg:flex",
        expanded
          ? "w-48 items-stretch rounded-3xl px-3"
          : "w-14 items-center rounded-full",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <button
          onClick={toggle}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          title={expanded ? "Collapse" : "Expand"}
          className={clsx(
            "mb-1 flex items-center justify-center gap-2 overflow-hidden rounded-full transition-transform active:scale-[0.97]",
            expanded
              ? "h-10 w-full border border-border/15 bg-white px-3 text-signal shadow-sm hover:border-signal/30"
              : "h-8 bg-signal text-signal-ink shadow-glow hover:bg-signal/90",
          )}
        >
          <ChevronLeftIcon
            className={clsx("shrink-0", !expanded && "rotate-180")}
          />
          {expanded && <span className="text-sm font-medium">Collapse</span>}
        </button>
        {RAIL_NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-2.5 overflow-hidden rounded-full transition-colors",
                expanded ? "h-10 w-full px-3" : "h-10 w-10 justify-center",
                isActive
                  ? "bg-signal text-signal-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )
            }
          >
            <NavIcon className="shrink-0" />
            {expanded && (
              <span className="truncate text-sm font-medium">{label}</span>
            )}
          </NavLink>
        ))}
      </div>
      <Link
        to="/runs"
        title="Launch a run"
        className={clsx(
          "mt-auto flex items-center gap-2 overflow-hidden rounded-full bg-signal text-signal-ink shadow-glow transition-transform hover:bg-signal/90 active:scale-[0.97]",
          expanded
            ? "h-10 w-full justify-center px-3"
            : "h-10 w-10 justify-center self-center",
        )}
      >
        <PlusIcon className="shrink-0" />
        {expanded && <span className="text-sm font-medium">New run</span>}
      </Link>
    </aside>
  );
}
