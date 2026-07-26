import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useJobs, useRuns, useTracker } from "../../api/queries";
import type { ScrapedJob, TrackerRow } from "../../api/types";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTheme } from "../../hooks/useTheme";
import { Avatar } from "../Avatar";
import { MenuIcon, SearchIcon } from "../icons";
import { LogoMark } from "./LogoMark";
import { CORE_NAV_ITEMS } from "./navItems";

function SearchResultsList({
  jobs,
  rows,
  onSelectJob,
  onSelectRow,
}: {
  jobs: ScrapedJob[];
  rows: TrackerRow[];
  onSelectJob: () => void;
  onSelectRow: (rowId: string) => void;
}) {
  if (jobs.length === 0 && rows.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted">No matches.</p>;
  }
  return (
    <>
      {jobs.map((job) => (
        <a
          key={job.key}
          href={job.url}
          target="_blank"
          rel="noreferrer"
          onClick={onSelectJob}
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-surface-2"
        >
          <Avatar name={job.company} size={22} />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{job.title}</span>
            <span className="text-muted"> at {job.company}</span>
          </span>
          <span className="shrink-0 text-[10px] text-muted">Posting ↗</span>
        </a>
      ))}
      {rows.map((row) => (
        <button
          key={row.id}
          onClick={() => onSelectRow(row.id)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-2"
        >
          <Avatar name={row.company} size={22} />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{row.company}</span>
            <span className="text-muted"> · {row.role}</span>
          </span>
          <span className="shrink-0 text-[10px] text-muted">Pipeline</span>
        </button>
      ))}
    </>
  );
}

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggle } = useTheme();
  const { data: runs } = useRuns();
  const { data: jobs } = useJobs();
  const { data: tracker } = useTracker();
  const navigate = useNavigate();
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runningCount = runs?.filter((r) => r.status === "running").length ?? 0;
  const approvalCount =
    runs?.reduce((sum, r) => sum + (r.pendingApprovals ?? 0), 0) ?? 0;
  const isUrgent = approvalCount > 0;
  const isActive = isUrgent || runningCount > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { jobs: [], rows: [] };
    return {
      jobs: (jobs ?? [])
        .filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(q))
        .slice(0, 4),
      rows: (tracker ?? [])
        .filter((r) => `${r.company} ${r.role}`.toLowerCase().includes(q))
        .slice(0, 4),
    };
  }, [query, jobs, tracker]);

  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  useEffect(() => {
    setSearchOpen(false);
  }, [isMobile]);

  const goToPipelineRow = (rowId: string) => {
    setSearchOpen(false);
    setQuery("");
    navigate("/pipeline", { state: { openRowId: rowId } });
  };

  const openSearch = () => {
    setSearchOpen((v) => {
      const next = !v;
      if (next && !isMobile)
        requestAnimationFrame(() => inputRef.current?.focus());
      return next;
    });
  };

  return (
    <header className="relative z-30 flex items-center gap-2 border-b border-border/10 px-4 py-3 sm:gap-3 sm:px-5 lg:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="shrink-0 rounded-full border border-border/15 p-1.5 text-muted transition-colors hover:border-signal/30 hover:text-signal lg:hidden"
      >
        <MenuIcon />
      </button>

      <Link to="/" className="flex shrink-0 items-center gap-2">
        <LogoMark />
        <span className="truncate text-sm font-bold tracking-tight text-ink sm:hidden lg:inline">
          AI Job Search
        </span>
      </Link>

      <nav className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
        {CORE_NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive: active }) =>
              clsx(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors lg:px-3.5",
                active
                  ? "bg-signal text-signal-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )
            }
          >
            <NavIcon />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1 sm:hidden" />

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="relative hidden sm:block" ref={searchContainerRef}>
          <div
            className={clsx(
              "flex items-center overflow-hidden rounded-full border transition-all duration-200 ease-out",
              searchOpen
                ? "w-56 border-signal/40 bg-surface lg:w-64"
                : "w-9 border-border/15 bg-transparent",
            )}
          >
            <button
              onClick={openSearch}
              aria-label="Search"
              aria-haspopup="true"
              aria-expanded={searchOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-muted transition-colors hover:text-signal"
            >
              <SearchIcon />
            </button>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search postings..."
              tabIndex={searchOpen ? 0 : -1}
              className="h-9 min-w-0 flex-1 bg-transparent pr-3.5 text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </div>

          {searchOpen && query.trim() && (
            <div className="animate-dropdown-in absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-border/10 bg-surface p-1.5 shadow-lg lg:w-80">
              <div className="thin-scrollbar max-h-72 overflow-y-auto">
                <SearchResultsList
                  jobs={results.jobs}
                  rows={results.rows}
                  onSelectJob={() => setSearchOpen(false)}
                  onSelectRow={goToPipelineRow}
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={openSearch}
          aria-label="Search"
          aria-haspopup="true"
          aria-expanded={searchOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/15 text-muted transition-colors hover:border-signal/30 hover:text-signal sm:hidden"
        >
          <SearchIcon />
        </button>

        <Link
          to="/runs"
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
            isUrgent
              ? "border-amber-500/40 text-amber-700 dark:text-amber-500"
              : runningCount > 0
                ? "border-signal/40 text-signal"
                : "border-border/15 text-muted hover:border-signal/30 hover:text-signal"
          }`}
        >
          {isActive && (
            <span
              className={`animate-badge-pulse h-1.5 w-1.5 rounded-full ${isUrgent ? "bg-amber-500" : "bg-signal"}`}
            />
          )}
          <span className="hidden sm:inline">
            Runs
            {isUrgent
              ? ` · ${approvalCount} needs approval`
              : runningCount > 0
                ? ` · ${runningCount} running`
                : ""}
          </span>
          <span className="sm:hidden">Runs</span>
        </Link>
        <button
          onClick={toggle}
          className="rounded-full border border-border/15 p-1.5 text-sm text-muted transition-colors hover:border-signal/30 hover:text-signal"
          aria-label="Toggle color theme"
          title="Toggle color theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      <Dialog.Root open={searchOpen && isMobile} onOpenChange={setSearchOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] sm:hidden" />
          <Dialog.Content className="search-sheet-content fixed inset-x-0 top-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-b-3xl border-b border-border/10 bg-surface shadow-2xl sm:hidden">
            <Dialog.Title className="sr-only">Search</Dialog.Title>
            <div className="flex items-center gap-2 border-b border-border/10 px-4 py-3">
              <SearchIcon className="shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search postings, companies, roles..."
                autoFocus
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
              />
              <Dialog.Close className="shrink-0 rounded-full px-2.5 py-1.5 text-sm font-medium text-signal">
                Cancel
              </Dialog.Close>
            </div>
            <div className="thin-scrollbar flex-1 overflow-y-auto p-2">
              {!query.trim() ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Start typing to search postings and applications.
                </p>
              ) : (
                <SearchResultsList
                  jobs={results.jobs}
                  rows={results.rows}
                  onSelectJob={() => setSearchOpen(false)}
                  onSelectRow={goToPipelineRow}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
