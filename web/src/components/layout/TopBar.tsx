import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useJobs, useRuns, useTracker } from "../../api/queries";
import { useTheme } from "../../hooks/useTheme";
import { Avatar } from "../Avatar";
import { MenuIcon, SearchIcon } from "../icons";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggle } = useTheme();
  const { data: runs } = useRuns();
  const { data: jobs } = useJobs();
  const { data: tracker } = useTracker();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const runningCount = runs?.filter((r) => r.status === "running").length ?? 0;
  const approvalCount = runs?.reduce((sum, r) => sum + (r.pendingApprovals ?? 0), 0) ?? 0;
  const isUrgent = approvalCount > 0;
  const isActive = isUrgent || runningCount > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { jobs: [], rows: [] };
    return {
      jobs: (jobs ?? []).filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(q)).slice(0, 4),
      rows: (tracker ?? []).filter((r) => `${r.company} ${r.role}`.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [query, jobs, tracker]);

  const hasResults = results.jobs.length > 0 || results.rows.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToPipelineRow = (rowId: string) => {
    setOpen(false);
    setQuery("");
    navigate("/pipeline", { state: { openRowId: rowId } });
  };

  return (
    <header className="relative z-30 flex items-center justify-between gap-2 border-b border-border/10 bg-base/80 px-4 py-3 backdrop-blur sm:gap-4 sm:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="shrink-0 rounded-full border border-border/15 p-1.5 text-muted transition-colors hover:border-signal/30 hover:text-signal lg:hidden"
      >
        <MenuIcon />
      </button>
      <div ref={containerRef} className="relative min-w-0 flex-1 sm:max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search postings, companies, roles..."
          className="w-full rounded-full border border-border/15 bg-surface py-1.5 pl-9 pr-3.5 text-sm text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30"
        />
        {open && query.trim() && (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border/10 bg-surface p-1.5 shadow-lg">
            {!hasResults && <p className="px-3 py-2 text-xs text-muted">No matches.</p>}
            {results.jobs.map((job) => (
              <a
                key={job.key}
                href={job.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
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
            {results.rows.map((row) => (
              <button
                key={row.id}
                onClick={() => goToPipelineRow(row.id)}
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
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
    </header>
  );
}
