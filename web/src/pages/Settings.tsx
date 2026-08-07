import clsx from "clsx";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  useLaunchRun,
  usePortalSkills,
  useRegisteredTemplates,
  useSearchQueries,
  useSetPortalEnabled,
  useSettings,
  useUpdateSearchQueries,
  useUpdateSettings,
} from "../api/queries";
import type { PortalSkill } from "../api/types";
import { Drawer } from "../components/Drawer";
import { PageHeader } from "../components/layout/PageHeader";
import { InlineSectionHeading } from "../components/layout/SectionHeading";
import { QueryState } from "../components/QueryState";
import { useToast } from "../components/Toast";
import { useConfirm } from "../hooks/useConfirm";
import {
  getNotificationsEnabledSnapshot,
  setNotificationsEnabled,
  subscribeNotificationsEnabled,
} from "../lib/notifications";
import { primaryButtonClass } from "../lib/ui";

const textareaClass =
  "w-full rounded-2xl border border-border/15 bg-surface px-3.5 py-2.5 font-mono text-xs leading-relaxed text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";
const inputClass =
  "w-full rounded-full border border-border/15 bg-surface px-3.5 py-1.5 font-mono text-xs text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";

const unreachableFallback = (
  <p className="text-sm text-red-500">Couldn't reach the dashboard server. Make sure it's running.</p>
);

function SearchQueriesEditor() {
  const queriesQuery = useSearchQueries();
  const updateQueries = useUpdateSearchQueries();
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (queriesQuery.data && draft === null) setDraft(queriesQuery.data.content);
  }, [queriesQuery.data, draft]);

  return (
    <QueryState
      query={{ isLoading: draft === null, isError: queriesQuery.isError }}
      errorFallback={unreachableFallback}
    >
      {() => {
        const value = draft as string;
        const isDirty = value !== queriesQuery.data?.content;

        return (
          <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <InlineSectionHeading>Search queries</InlineSectionHeading>
                <p className="text-xs text-muted">
                  Drives what <code>/scrape</code> searches for. Edits here save straight to{" "}
                  <code>.claude/skills/job-scraper/search-queries.md</code>.
                </p>
              </div>
              <button
                onClick={() => updateQueries.mutate(value)}
                disabled={!isDirty || updateQueries.isPending}
                className={primaryButtonClass}
              >
                {updateQueries.isPending ? "Saving..." : "Save"}
              </button>
            </div>
            {updateQueries.isError && (
              <p className="mb-2 text-xs text-red-500">{(updateQueries.error as Error).message}</p>
            )}
            {updateQueries.isSuccess && !isDirty && <p className="mb-2 text-xs text-emerald-500">Saved.</p>}
            <textarea
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              rows={22}
              className={textareaClass}
              spellCheck={false}
            />
          </section>
        );
      }}
    </QueryState>
  );
}

function PermissionsEditor() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [allow, setAllow] = useState<string[] | null>(null);

  useEffect(() => {
    if (settingsQuery.data && allow === null) setAllow(settingsQuery.data.allow);
  }, [settingsQuery.data, allow]);

  return (
    <QueryState
      query={{ isLoading: allow === null, isError: settingsQuery.isError }}
      errorFallback={unreachableFallback}
    >
      {() => {
        const patterns = allow as string[];
        const isDirty = JSON.stringify(patterns) !== JSON.stringify(settingsQuery.data?.allow ?? []);

        const setPattern = (i: number, value: string) =>
          setAllow((prev) => prev!.map((p, idx) => (idx === i ? value : p)));
        const removePattern = (i: number) => setAllow((prev) => prev!.filter((_, idx) => idx !== i));
        const addPattern = () => setAllow((prev) => [...prev!, ""]);

        return (
          <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <InlineSectionHeading>Auto-approved commands</InlineSectionHeading>
                <p className="text-xs text-muted">
                  Tool patterns here run without an approval prompt. Only add commands you trust. Saves to{" "}
                  <code>.claude/settings.json</code>.
                </p>
              </div>
              <button
                onClick={() => updateSettings.mutate(patterns.filter((p) => p.trim()))}
                disabled={!isDirty || updateSettings.isPending}
                className={primaryButtonClass}
              >
                {updateSettings.isPending ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                Advanced, and a little dangerous. A pattern here lets Claude Code run that exact command
                against your machine with no approval step, every time, in every run. Only add a pattern if
                you understand exactly what it lets run and you trust it unconditionally. When unsure, leave
                it out. Denied commands just show an approval prompt instead, they still work fine.
              </p>
            </div>
            {updateSettings.isError && (
              <p className="mb-2 text-xs text-red-500">{(updateSettings.error as Error).message}</p>
            )}
            {updateSettings.isSuccess && !isDirty && <p className="mb-2 text-xs text-emerald-500">Saved.</p>}
            <div className="flex flex-col gap-2">
              {patterns.map((pattern, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={pattern}
                    onChange={(e) => setPattern(i, e.target.value)}
                    placeholder='e.g. Bash(npm run:*)'
                    className={inputClass}
                  />
                  <button
                    onClick={() => removePattern(i)}
                    aria-label="Remove pattern"
                    className="shrink-0 rounded-full border border-border/15 px-2.5 py-1 text-xs text-muted transition-colors hover:border-red-500/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addPattern}
                className="self-start rounded-full border border-border/15 px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal"
              >
                + Add pattern
              </button>
            </div>
          </section>
        );
      }}
    </QueryState>
  );
}

function PortalToggle({
  enabled,
  onToggle,
  pending,
}: {
  enabled: boolean;
  onToggle: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={pending}
      title={enabled ? "Disable this portal" : "Enable this portal"}
      className={clsx(
        "mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        enabled ? "bg-signal" : "bg-surface-2",
      )}
    >
      <span
        className={clsx(
          "h-3 w-3 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-3.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

type PortalStatusFilter = "all" | "problems" | "disabled";

function isProblemPortal(portal: PortalSkill): boolean {
  return portal.enabled && (portal.healthStatus === "error" || portal.healthStatus === "zero_results");
}

function portalSortWeight(portal: PortalSkill): number {
  if (!portal.enabled) return 3;
  if (portal.healthStatus === "error") return 0;
  if (portal.healthStatus === "zero_results") return 1;
  return 2;
}

function PortalFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-signal/40 bg-signal/10 text-signal"
          : "border-border/15 text-muted hover:border-signal/30 hover:text-signal",
      )}
    >
      {children}
    </button>
  );
}

function AddPortalDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const launchRun = useLaunchRun();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  const handleSubmit = () => {
    launchRun.mutate(
      { command: "/add-portal", args: url.trim() },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Add portal">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-xs text-muted">
          Starts <code>/add-portal</code> with this URL as the first answer. It'll ask a few
          follow-up questions (skill name, market, a test query) as plain replies on the Runs page.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Portal URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example-job-board.com"
            className={inputClass}
            autoFocus
          />
        </label>
        {launchRun.isError && (
          <p className="text-xs text-red-500">{(launchRun.error as Error).message}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!url.trim() || launchRun.isPending}
          className={primaryButtonClass}
        >
          {launchRun.isPending ? "Starting..." : "Start /add-portal"}
        </button>
      </div>
    </Drawer>
  );
}

function InstalledPortals() {
  const portalsQuery = usePortalSkills();
  const portals = portalsQuery.data ?? [];
  const setPortalEnabled = useSetPortalEnabled();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PortalStatusFilter>("all");
  const [addPortalOpen, setAddPortalOpen] = useState(false);

  const problemCount = useMemo(() => portals.filter(isProblemPortal).length, [portals]);
  const disabledCount = useMemo(() => portals.filter((p) => !p.enabled).length, [portals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portals
      .filter((portal) => {
        if (statusFilter === "problems" && !isProblemPortal(portal)) return false;
        if (statusFilter === "disabled" && portal.enabled) return false;
        if (q && !`${portal.name} ${portal.descriptionPreview}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => portalSortWeight(a) - portalSortWeight(b));
  }, [portals, search, statusFilter]);

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <InlineSectionHeading>Installed portals</InlineSectionHeading>
          <p className="text-xs text-muted">Job-board search skills <code>/scrape</code> runs.</p>
        </div>
        <button
          onClick={() => setAddPortalOpen(true)}
          className="shrink-0 rounded-full border border-border/15 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal"
        >
          + Add portal
        </button>
      </div>
      <QueryState query={portalsQuery} errorFallback={unreachableFallback}>
        {() =>
          portals.length === 0 ? (
            <p className="text-xs text-muted">No portal skills found under <code>.agents/skills/</code>.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search portals..."
                  className={`w-48 ${inputClass}`}
                />
                <PortalFilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                  All
                </PortalFilterChip>
                <PortalFilterChip
                  active={statusFilter === "problems"}
                  onClick={() => setStatusFilter(statusFilter === "problems" ? "all" : "problems")}
                >
                  Problems ({problemCount})
                </PortalFilterChip>
                <PortalFilterChip
                  active={statusFilter === "disabled"}
                  onClick={() => setStatusFilter(statusFilter === "disabled" ? "all" : "disabled")}
                >
                  Disabled ({disabledCount})
                </PortalFilterChip>
              </div>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted">No portals match these filters.</p>
              ) : (
                <ul className="thin-scrollbar flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-0.5">
                  {filtered.map((portal) => (
                <li
                  key={portal.name}
                  className="flex items-start gap-2.5 rounded-2xl border border-border/10 px-3 py-2"
                >
                  <PortalToggle
                    enabled={portal.enabled}
                    pending={
                      setPortalEnabled.isPending &&
                      setPortalEnabled.variables?.name === portal.name
                    }
                    onToggle={() =>
                      setPortalEnabled.mutate(
                        { name: portal.name, enabled: !portal.enabled },
                        {
                          onError: (err) =>
                            push({
                              tone: "error",
                              title: "Couldn't update portal",
                              description:
                                err instanceof Error ? err.message : String(err),
                            }),
                        },
                      )
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {portal.name}
                      {!portal.enabled && <span className="ml-2 text-xs font-normal text-muted">disabled</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{portal.descriptionPreview}</p>
                    {portal.enabled && portal.healthStatus && portal.healthStatus !== "skipped_disabled" && (
                      <p
                        className={clsx(
                          "mt-1 text-xs",
                          portal.healthStatus === "ok"
                            ? "text-muted"
                            : "font-medium text-amber-600 dark:text-amber-500",
                        )}
                      >
                        {portal.healthStatus === "ok" &&
                          `✓ ${portal.lastResultCount ?? 0} result${portal.lastResultCount === 1 ? "" : "s"} last check`}
                        {portal.healthStatus === "zero_results" &&
                          "⚠ 0 results last check - worth a look if this repeats"}
                        {portal.healthStatus === "error" && "⚠ errored last check"}
                        {portal.lastChecked && ` (${portal.lastChecked})`}
                      </p>
                    )}
                  </div>
                </li>
                  ))}
                </ul>
              )}
            </>
          )
        }
      </QueryState>
      <AddPortalDrawer open={addPortalOpen} onOpenChange={setAddPortalOpen} />
    </section>
  );
}

function ActiveTemplates() {
  const templatesQuery = useRegisteredTemplates();
  const templates = templatesQuery.data ?? [];

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <InlineSectionHeading>Active templates</InlineSectionHeading>
      <p className="mb-3 text-xs text-muted">
        Custom CV / cover letter templates <code>/apply</code> can draft from. Register one with{" "}
        <code>/add-template</code> from Runs.
      </p>
      <QueryState query={templatesQuery} errorFallback={unreachableFallback}>
        {() =>
          templates.length === 0 ? (
            <p className="text-xs text-muted">
              No custom templates registered — <code>/apply</code> uses the stock templates.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((template) => (
                <li
                  key={`${template.type}-${template.name}`}
                  className="flex items-start gap-2.5 rounded-2xl border border-border/10 px-3 py-2"
                >
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${template.active ? "bg-signal" : "bg-muted"}`}
                    title={template.active ? "Active" : "Registered, not active"}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {template.name}
                      {template.active ? (
                        <span className="ml-2 text-xs font-normal text-muted">active</span>
                      ) : (
                        <span className="ml-2 text-xs font-normal text-muted">
                          registered · switch with <code>/add-template --use {template.name}</code>
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {template.type === "cv" ? "CV" : "Cover letter"} · {template.engine} · {template.pageLimit}
                      {template.fonts ? ` · ${template.fonts}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </section>
  );
}

function NotificationsSection() {
  const enabled = useSyncExternalStore(
    subscribeNotificationsEnabled,
    getNotificationsEnabledSnapshot,
    getNotificationsEnabledSnapshot,
  );
  const supported = typeof Notification !== "undefined";
  const [permissionDenied, setPermissionDenied] = useState(
    supported && Notification.permission === "denied",
  );

  const handleToggle = async () => {
    if (enabled) {
      setNotificationsEnabled(false);
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
    } else {
      setPermissionDenied(permission === "denied");
    }
  };

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <InlineSectionHeading>Notifications</InlineSectionHeading>
      <p className="mb-3 text-xs text-muted">
        Notifies you about stale applications and upcoming interviews while this tab is open
        (including backgrounded) — closing the tab or browser stops it. Nothing is sent anywhere
        else; this only re-checks data the dashboard already loads.
      </p>
      {!supported ? (
        <p className="text-xs text-muted">Your browser doesn't support notifications.</p>
      ) : permissionDenied && !enabled ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Notifications are blocked for this site in your browser's settings. Re-enable them
          there, then try again.
        </p>
      ) : (
        <div className="flex items-center gap-2.5">
          <PortalToggle enabled={enabled} pending={false} onToggle={handleToggle} />
          <span className="text-sm text-ink">{enabled ? "Enabled" : "Disabled"}</span>
        </div>
      )}
    </section>
  );
}

type ResetScope = "profile" | "documents" | "all";

const RESET_SCOPES: { scope: ResetScope; label: string; description: string }[] = [
  {
    scope: "profile",
    label: "Profile",
    description:
      "Clears candidate data from the skill files (profile, behavioral, STAR examples, profile statements). The framework structure and writing rules are preserved.",
  },
  {
    scope: "documents",
    label: "Documents",
    description:
      "Deletes all files you've placed in the documents/ folder (CV PDFs, LinkedIn export, diplomas, references, past applications). The folder structure and README.md are preserved.",
  },
  {
    scope: "all",
    label: "Everything",
    description: "Both of the above.",
  },
];

function ResetSection() {
  const launchRun = useLaunchRun();
  const navigate = useNavigate();
  const confirmReset = useConfirm<ResetScope>();

  const handleClick = (scope: ResetScope) => {
    if (!confirmReset.isArmed(scope)) {
      confirmReset.arm(scope);
      return;
    }
    launchRun.mutate(
      { command: "/reset", args: scope },
      {
        onSuccess: ({ runId }) => {
          confirmReset.disarm();
          navigate(`/runs/${runId}`);
        },
      },
    );
  };

  return (
    <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.03] p-4 shadow-sm">
      <InlineSectionHeading>Reset</InlineSectionHeading>
      <p className="mb-3 text-xs text-muted">
        Wipe candidate data back to a blank slate so you can run <code>/setup</code> again. This
        starts <code>/reset</code>, which will still ask you to type <code>RESET</code> to confirm
        once it's running — answer that from the run's Reply box.
      </p>
      {launchRun.isError && (
        <p className="mb-2 text-xs text-red-500">{(launchRun.error as Error).message}</p>
      )}
      <div className="flex flex-col gap-2">
        {RESET_SCOPES.map(({ scope, label, description }) => {
          const armed = confirmReset.isArmed(scope);
          return (
            <div
              key={scope}
              className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/15 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-muted">{description}</p>
              </div>
              <button
                onClick={() => handleClick(scope)}
                disabled={launchRun.isPending}
                className={clsx(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  armed
                    ? "border-red-500/50 bg-red-500/10 text-red-500"
                    : "border-border/15 text-muted hover:border-red-500/30 hover:text-red-500",
                )}
              >
                {armed ? (launchRun.isPending ? "Starting..." : "Confirm?") : "Reset..."}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        subtitle="Configure how Claude Code searches and acts on your behalf, no file editor needed."
      />
      <SearchQueriesEditor />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PermissionsEditor />
        <InstalledPortals />
        <ActiveTemplates />
        <NotificationsSection />
      </div>
      <ResetSection />
    </div>
  );
}
