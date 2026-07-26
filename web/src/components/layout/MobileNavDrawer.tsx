import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { LogoMark } from "./LogoMark";
import { ALL_NAV_ITEMS } from "./navItems";

export function MobileNavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, toggle } = useTheme();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden" />
        <Dialog.Content className="mobile-nav-content fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden rounded-r-3xl border-r border-border/10 bg-surface shadow-2xl lg:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div className="signal-glow flex items-start justify-between gap-2 px-5 pb-5 pt-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
                <LogoMark />
                AI Job Search
              </p>
              <p className="mt-0.5 text-xs text-muted">
                The job search that runs on your machine.
              </p>
            </div>
            <Dialog.Close
              aria-label="Close menu"
              className="shrink-0 rounded-full p-1 text-lg leading-none text-muted transition-colors hover:text-ink"
            >
              ✕
            </Dialog.Close>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {ALL_NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => onOpenChange(false)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-signal text-signal-ink"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                <NavIcon />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 px-3 pb-4">
            <button
              onClick={toggle}
              className="flex items-center gap-2.5 rounded-full border border-border/15 px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal"
            >
              {theme === "dark" ? "☀️" : "🌙"}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <div className="px-2.5 text-[11px] leading-snug text-muted/70">
              Local-only. Nothing here leaves this machine.
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
