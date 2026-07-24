import clsx from "clsx";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ChevronLeftIcon,
  DiscoveryIcon,
  OverviewIcon,
  PipelineIcon,
  ProfileIcon,
  RunsIcon,
  SalaryIcon,
  SettingsIcon,
  UpskillIcon,
} from "../icons";

const COLLAPSE_KEY = "ai-job-search:sidebar-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSE_KEY) === "1";
}

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: OverviewIcon, end: true },
  { to: "/discovery", label: "Discovery", icon: DiscoveryIcon, end: false },
  { to: "/pipeline", label: "Pipeline", icon: PipelineIcon, end: false },
  { to: "/upskill", label: "Upskill", icon: UpskillIcon, end: false },
  { to: "/salary", label: "Salary", icon: SalaryIcon, end: false },
  { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
  { to: "/runs", label: "Runs", icon: RunsIcon, end: false },
];

// Pip, the ai-job-search mascot (assets/mascot/pip_flight_loop.gif upstream).
// Falls back to the pulsing dot glyph if the asset is ever missing, so a
// broken-image icon never shows in the sidebar.
function LogoMark() {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
      </span>
    );
  }
  return (
    <img
      src="/logo.gif"
      alt=""
      className="h-8 w-8 shrink-0 rounded-lg object-contain"
      onError={() => setBroken(true)}
    />
  );
}

// Below the lg breakpoint the sidebar is an off-canvas overlay (fixed,
// translated out of view, toggled by TopBar's hamburger button); at lg+ it's
// back in normal flow and always visible, same as before this was added.
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-hidden border-r border-border/10 bg-surface px-3 py-4 transition-all duration-200 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          collapsed ? "lg:w-[76px]" : "lg:w-56",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={clsx(
            "signal-glow -mx-3 -mt-4 mb-6 flex items-start gap-2 px-5 pb-5 pt-4",
            collapsed ? "lg:justify-center lg:px-0" : "justify-between",
          )}
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
              <LogoMark />
              <span className={clsx(collapsed && "lg:hidden")}>AI Job Search</span>
            </p>
            <p className={clsx("mt-0.5 text-xs text-muted", collapsed && "lg:hidden")}>
              The job search that runs on your machine.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 rounded-full p-1 text-lg leading-none text-muted transition-colors hover:text-ink lg:hidden"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-signal text-signal-ink"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )
              }
            >
              <NavIcon />
              <span className={clsx(collapsed && "lg:hidden")}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={clsx(
              "hidden shrink-0 items-center gap-1.5 rounded-full border border-border/15 py-1.5 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal lg:flex",
              collapsed ? "lg:justify-center lg:px-0" : "justify-center px-3",
            )}
          >
            <ChevronLeftIcon className={clsx(collapsed && "rotate-180")} />
            <span className={clsx(collapsed && "lg:hidden")}>Collapse</span>
          </button>
          <div className={clsx("px-2.5 text-[11px] leading-snug text-muted/70", collapsed && "lg:hidden")}>
            Local-only. Nothing here leaves this machine.
          </div>
        </div>
      </aside>
    </>
  );
}
