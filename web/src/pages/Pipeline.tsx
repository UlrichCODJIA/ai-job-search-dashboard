import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useApplications,
  useLaunchRun,
  useTracker,
  useUpdateTrackerRow,
} from "../api/queries";
import type { StatusBucket, TrackerRow } from "../api/types";
import { Avatar } from "../components/Avatar";
import { HorizontalBarChart } from "../components/charts/BarChart";
import { Drawer } from "../components/Drawer";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionHeading } from "../components/layout/SectionHeading";
import { Markdown } from "../components/Markdown";
import { STATUS_COLORS } from "../components/Pill";
import { QueryState } from "../components/QueryState";
import { findMatchingApplication } from "../lib/applicationMatch";
import { isPastDeadline, isUrgentDeadline } from "../lib/deadline";
import {
  daysAgoLabel,
  daysSince,
  groupCount,
  isStaleActiveRow,
  isStaleDraftRow,
  isStaleInterviewRow,
} from "../lib/pipeline";
import { companySlug } from "../lib/slug";
import {
  inputClass,
  outlineButtonClass,
  primaryButtonClass,
  textareaClass,
} from "../lib/ui";

const BUCKETS: StatusBucket[] = [
  "Drafted",
  "Active",
  "Interview",
  "Offer",
  "Hired",
  "Rejected/Closed",
];

const STATUS_OPTIONS = [
  "drafted",
  "applied",
  "interview",
  "offer",
  "hired",
  "rejected",
  "no_response",
  "offer_declined",
  "interview_only",
  "withdrawn",
];

function DocumentLink({
  slug,
  filename,
  label,
}: {
  slug: string;
  filename: string;
  label?: string;
}) {
  return (
    <a
      href={`/api/applications/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`}
      target="_blank"
      rel="noreferrer"
      download
      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-signal/10 hover:text-signal"
      title={`Download ${filename}`}
    >
      <span aria-hidden>⬇</span>
      {label ?? filename}
    </a>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="font-medium text-ink">{value || "N/A"}</p>
    </div>
  );
}

export default function Pipeline() {
  const trackerQuery = useTracker();
  const applicationsQuery = useApplications();
  const updateTrackerRow = useUpdateTrackerRow();
  const launchRun = useLaunchRun();
  const navigate = useNavigate();
  const location = useLocation();
  const [selected, setSelected] = useState<TrackerRow | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const tracker = trackerQuery.data ?? [];
  const applications = applicationsQuery.data ?? [];

  const rowsByBucket = useMemo(() => {
    const map = new Map<StatusBucket, TrackerRow[]>();
    for (const bucket of BUCKETS) map.set(bucket, []);
    for (const row of tracker) {
      map.get(row.bucket)?.push(row);
    }
    return map;
  }, [tracker]);

  const sectorCounts = useMemo(() => groupCount(tracker, "sector"), [tracker]);
  const channelCounts = useMemo(
    () => groupCount(tracker, "channel"),
    [tracker],
  );

  useEffect(() => {
    const openRowId = (location.state as { openRowId?: string } | null)
      ?.openRowId;
    if (!openRowId || tracker.length === 0) return;
    const row = tracker.find((r) => r.id === openRowId);
    if (row) setSelected(row);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, tracker.length]);

  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status);
      setEditNotes(selected.notes);
    }
  }, [selected?.id]);

  const matchedApplication = useMemo(() => {
    if (!selected) return null;
    return (
      applications.find((app) => app.trackerRow?.id === selected.id) ??
      findMatchingApplication(applications, selected.company)
    );
  }, [applications, selected]);

  const statusOptions = useMemo(() => {
    if (!selected || STATUS_OPTIONS.includes(selected.status))
      return STATUS_OPTIONS;
    return [selected.status, ...STATUS_OPTIONS];
  }, [selected]);

  const isDirty =
    selected != null &&
    (editStatus !== selected.status || editNotes !== selected.notes);

  const handleSave = () => {
    if (!selected) return;
    const patch: { status?: string; notes?: string } = {};
    const expected: { expectedStatus?: string; expectedNotes?: string } = {};
    if (editStatus !== selected.status) {
      patch.status = editStatus;
      expected.expectedStatus = selected.status;
    }
    if (editNotes !== selected.notes) {
      patch.notes = editNotes;
      expected.expectedNotes = selected.notes;
    }
    if (Object.keys(patch).length === 0) return;

    const savingId = selected.id;
    updateTrackerRow.mutate(
      { id: selected.id, patch, expected },
      {
        onSuccess: (updated) =>
          setSelected((current) =>
            current?.id === savingId ? updated : current,
          ),
      },
    );
  };

  const launchOnSelected = (command: "/outcome" | "/interview") => {
    if (!selected) return;
    launchRun.mutate(
      {
        command,
        args: selected.company,
        resumeKey: companySlug(selected.company),
      },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  return (
    <QueryState query={trackerQuery}>
      {() =>
        tracker.length === 0 ? (
          <div className="flex flex-col gap-4">
            <PageHeader
              title="Pipeline"
              subtitle="Your tracked applications, from first draft to outcome."
            />
            <EmptyState
              title="No applications tracked yet"
              description="Run /apply on a job posting from Claude Code to start your pipeline. Applications will appear here as a board across six stages, starting the moment a draft exists."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <PageHeader
              title="Pipeline"
              subtitle={`${tracker.length} application${tracker.length === 1 ? "" : "s"} tracked.`}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {BUCKETS.map((bucket) => {
                const rows = rowsByBucket.get(bucket) ?? [];
                return (
                  <div
                    key={bucket}
                    className="flex flex-col gap-2 rounded-3xl border border-border/10 bg-surface/60 p-3"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[bucket] }}
                        />
                        {bucket}
                      </span>
                      <span className="text-xs font-medium text-muted">
                        {rows.length}
                      </span>
                    </div>
                    <div className="thin-scrollbar flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-0.5">
                      {rows.length === 0 ? (
                        <p className="px-1 py-3 text-center text-xs text-muted/60">
                          No applications here yet
                        </p>
                      ) : (
                        rows.map((row) => {
                          const stale =
                            isStaleActiveRow(row) ||
                            isStaleDraftRow(row) ||
                            isStaleInterviewRow(row);
                          const interviewUrgent = isUrgentDeadline(row.next_interview_date);
                          const interviewPast = isPastDeadline(row.next_interview_date);
                          return (
                            <button
                              key={row.id}
                              onClick={() => setSelected(row)}
                              className="shrink-0 rounded-2xl border border-border/10 bg-surface px-3 py-2 text-left text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-signal/25 hover:shadow-glow"
                            >
                              <div className="flex items-center gap-2">
                                <Avatar name={row.company} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-ink">
                                    {row.company}
                                  </p>
                                  <p className="truncate text-xs text-muted">
                                    {row.role}
                                  </p>
                                </div>
                              </div>
                              <p
                                title={row.date}
                                className={clsx(
                                  "mt-1.5 text-[11px]",
                                  stale ? "font-medium text-amber-500" : "text-muted/60",
                                )}
                              >
                                {stale && "⚠ "}
                                {daysAgoLabel(daysSince(row.date))}
                              </p>
                              {row.next_interview_date && (
                                <p
                                  className={clsx(
                                    "mt-1 inline-flex items-center gap-1 text-[11px]",
                                    interviewUrgent && "font-semibold text-red-500",
                                    interviewPast && "font-medium text-amber-500",
                                    !interviewUrgent && !interviewPast && "text-signal",
                                  )}
                                >
                                  {interviewUrgent && "🔥"}
                                  {interviewPast
                                    ? `❓ Interview was ${row.next_interview_date} - log the outcome`
                                    : `Interview ${row.next_interview_date}`}
                                </p>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm lg:col-span-2">
                <SectionHeading>By sector</SectionHeading>
                <HorizontalBarChart bars={sectorCounts} />
              </section>
              <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
                <SectionHeading>By channel</SectionHeading>
                <HorizontalBarChart bars={channelCounts} />
              </section>
            </div>

            <Drawer
              open={selected !== null}
              onOpenChange={(open) => !open && setSelected(null)}
              title={selected ? `${selected.company} · ${selected.role}` : ""}
            >
              {selected && (
                <div className="flex flex-col gap-4 text-sm">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Field
                      label={selected.bucket === "Drafted" ? "Drafted" : "Applied"}
                      value={selected.date}
                    />
                    <Field label="Status" value={selected.status} />
                    <Field label="Sector" value={selected.sector} />
                    <Field label="Role type" value={selected.role_type} />
                    <Field label="Channel" value={selected.channel} />
                    <Field label="Contact" value={selected.contact_person} />
                    <Field label="Fit rating" value={selected.fit_rating} />
                    <Field
                      label="Source"
                      value={
                        selected.source ? (
                          <a
                            href={selected.source}
                            target="_blank"
                            rel="noreferrer"
                            className="text-signal hover:underline"
                          >
                            Posting link
                          </a>
                        ) : (
                          "N/A"
                        )
                      }
                    />
                    <Field label="CV file" value={selected.cv_file} />
                    <Field label="Cover letter" value={selected.cover_letter_file} />
                    <Field label="Next interview" value={selected.next_interview_date} />
                  </div>

                  <div className="rounded-2xl border border-border/10 p-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Update status / notes
                    </h3>
                    <div className="flex flex-col gap-2">
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className={inputClass}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                        placeholder="Notes..."
                        className={textareaClass}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSave}
                          disabled={!isDirty || updateTrackerRow.isPending}
                          className={primaryButtonClass}
                        >
                          {updateTrackerRow.isPending
                            ? "Saving..."
                            : "Save changes"}
                        </button>
                        {updateTrackerRow.isSuccess && !isDirty && (
                          <span className="text-xs text-emerald-500">
                            Saved
                          </span>
                        )}
                        {updateTrackerRow.isError && (
                          <span className="text-xs text-red-500">
                            {(updateTrackerRow.error as Error).message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {matchedApplication?.outcome && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Interview stages
                      </h3>
                      <ul className="flex flex-col gap-1.5">
                        {matchedApplication.outcome.stages.map((stage) => (
                          <li
                            key={stage.label}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                                stage.checked
                                  ? "bg-emerald-500 text-white"
                                  : "bg-surface-2 text-muted"
                              }`}
                            >
                              {stage.checked ? "✓" : ""}
                            </span>
                            <span
                              className={
                                stage.checked ? "text-ink" : "text-muted"
                              }
                            >
                              {stage.label}
                            </span>
                            {stage.date && (
                              <span className="text-xs text-muted">
                                ({stage.date})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {matchedApplication.outcome.notes && (
                        <div className="mt-3">
                          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                            Outcome notes
                          </h3>
                          <Markdown>
                            {matchedApplication.outcome.notes}
                          </Markdown>
                        </div>
                      )}
                    </div>
                  )}

                  {matchedApplication && (
                    <div className="flex flex-wrap gap-1.5">
                      {matchedApplication.hasJobPosting && (
                        <DocumentLink slug={matchedApplication.slug} filename="job_posting.md" />
                      )}
                      {matchedApplication.hasCvDraft && (
                        <DocumentLink slug={matchedApplication.slug} filename="cv_draft.tex" />
                      )}
                      {matchedApplication.hasCoverLetter && (
                        <DocumentLink slug={matchedApplication.slug} filename="cover_letter.tex" />
                      )}
                      {matchedApplication.interviewPrep.flatMap((p) => [
                        p.hasPrepPack && (
                          <DocumentLink
                            key={`${p.stage}-prep`}
                            slug={matchedApplication.slug}
                            filename={`interview_prep_${p.stage}.md`}
                            label={`prep: ${p.stage}`}
                          />
                        ),
                        p.hasCheatSheet && (
                          <DocumentLink
                            key={`${p.stage}-cheat`}
                            slug={matchedApplication.slug}
                            filename={`interview_cheatsheet_${p.stage}.md`}
                            label={`cheat sheet: ${p.stage}`}
                          />
                        ),
                      ])}
                    </div>
                  )}

                  <div className="flex gap-2 border-t border-border/10 pt-4">
                    <button
                      onClick={() => launchOnSelected("/outcome")}
                      disabled={launchRun.isPending}
                      className={outlineButtonClass}
                    >
                      Record outcome
                    </button>
                    <button
                      onClick={() => launchOnSelected("/interview")}
                      disabled={launchRun.isPending}
                      className={outlineButtonClass}
                    >
                      Prep interview
                    </button>
                  </div>
                </div>
              )}
            </Drawer>
          </div>
        )
      }
    </QueryState>
  );
}
