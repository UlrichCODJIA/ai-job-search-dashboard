import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDeleteDocument,
  useDocuments,
  useLaunchRun,
  useProfile,
  useUpdateProfileSection,
  useUploadDocument,
  useUploadFile,
  useUploads,
} from "../api/queries";
import type { MarkdownSection } from "../api/types";
import { PageHeader } from "../components/layout/PageHeader";
import { InlineSectionHeading } from "../components/layout/SectionHeading";
import { Markdown } from "../components/Markdown";
import { QueryState } from "../components/QueryState";
import { useConfirm } from "../hooks/useConfirm";
import { outlineButtonClass, primaryButtonClass } from "../lib/ui";

const textareaClass =
  "w-full rounded-2xl border border-border/15 bg-surface px-3.5 py-2.5 font-mono text-xs text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";
const selectClass =
  "mt-2 w-full rounded-full border border-border/15 bg-surface px-3 py-1.5 text-xs text-ink focus:border-signal/40 focus:outline-none focus:ring-1 focus:ring-signal/30";

const DOCUMENT_FOLDERS = [
  {
    key: "cv",
    label: "CV / resume",
    hint: "PDF or LaTeX, your most complete CV",
    accept: ".pdf,.tex",
  },
  {
    key: "linkedin",
    label: "LinkedIn export",
    hint: "PDF export of your profile",
    accept: ".pdf",
  },
  {
    key: "diplomas",
    label: "Diplomas",
    hint: "Degree certificates, transcripts",
    accept: ".pdf",
  },
  {
    key: "references",
    label: "Reference letters",
    hint: "PDF, text, or markdown",
    accept: ".pdf,.txt,.md",
  },
  {
    key: "postings",
    label: "Job postings",
    hint: "For pages Claude can't fetch. Name the file after the job title.",
    accept: ".txt",
  },
];

function DocumentUploadCard({
  folder,
}: {
  folder: (typeof DOCUMENT_FOLDERS)[number];
}) {
  const documentsQuery = useDocuments();
  const upload = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmDelete = useConfirm<string>();
  const files = documentsQuery.data?.[folder.key] ?? [];

  const handleDeleteClick = (filename: string) => {
    if (!confirmDelete.isArmed(filename)) {
      confirmDelete.arm(filename);
      return;
    }
    deleteDocument.mutate(
      { folder: folder.key, filename },
      { onSuccess: () => confirmDelete.disarm() },
    );
  };

  return (
    <div className="rounded-2xl border border-border/10 p-3">
      <p className="text-sm font-medium text-ink">{folder.label}</p>
      <p className="mt-0.5 text-xs text-muted">{folder.hint}</p>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
          {files.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate">{f}</span>
              <button
                onClick={() => handleDeleteClick(f)}
                disabled={deleteDocument.isPending}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  confirmDelete.isArmed(f)
                    ? "border-red-500/40 bg-red-500/10 text-red-500"
                    : "border-border/15 text-muted hover:border-red-500/30 hover:text-red-400"
                }`}
              >
                {confirmDelete.isArmed(f) ? "Confirm?" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {upload.isError && (
        <p className="mt-1 text-xs text-red-500">
          {(upload.error as Error).message}
        </p>
      )}
      {deleteDocument.isError && (
        <p className="mt-1 text-xs text-red-500">
          {(deleteDocument.error as Error).message}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={folder.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate({ folder: folder.key, file });
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="mt-2 rounded-full border border-border/15 px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
      >
        {upload.isPending ? "Uploading..." : "Upload file"}
      </button>
    </div>
  );
}

function ImportDocuments() {
  const launchRun = useLaunchRun();
  const navigate = useNavigate();

  const runSetup = () => {
    launchRun.mutate(
      { command: "/setup" },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <InlineSectionHeading>Import documents</InlineSectionHeading>
          <p className="mt-0.5 text-xs text-muted">
            Drop your CV, LinkedIn export, diplomas, or reference letters here
            (same as copying them into <code>documents/</code> by hand), then
            run <code>/setup</code> to build your profile from them.
          </p>
        </div>
        <button
          onClick={runSetup}
          disabled={launchRun.isPending}
          className="shrink-0 rounded-full bg-signal px-3.5 py-1.5 text-xs font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {launchRun.isPending ? "Starting..." : "Run /setup"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DOCUMENT_FOLDERS.map((folder) => (
          <DocumentUploadCard key={folder.key} folder={folder} />
        ))}
      </div>
    </section>
  );
}

function GenerateFromUploadCard({
  title,
  description,
  files,
  accept,
  chooseLabel,
  noFilesLabel,
  uploadButtonLabel,
  uploadPending,
  uploadError,
  onUpload,
  buildLaunchArgs,
}: {
  title: string;
  description: ReactNode;
  files: string[];
  accept: string;
  chooseLabel: string;
  noFilesLabel: string;
  uploadButtonLabel: string;
  uploadPending: boolean;
  uploadError: string | null;
  onUpload: (file: File, onSuccess: (filename: string) => void) => void;
  buildLaunchArgs: (filename: string) => { command: string; args: string };
}) {
  const launchRun = useLaunchRun();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState("");

  const handleGenerate = () => {
    if (!selected) return;
    launchRun.mutate(buildLaunchArgs(selected), {
      onSuccess: ({ runId }) => navigate(`/runs/${runId}`),
    });
  };

  return (
    <div className="rounded-2xl border border-border/10 p-3">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{description}</p>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={selectClass}
      >
        <option value="">{files.length ? chooseLabel : noFilesLabel}</option>
        {files.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file, setSelected);
          e.target.value = "";
        }}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploadPending}
          className={outlineButtonClass}
        >
          {uploadPending ? "Uploading..." : uploadButtonLabel}
        </button>
        <button
          onClick={handleGenerate}
          disabled={!selected || launchRun.isPending}
          className={primaryButtonClass}
        >
          {launchRun.isPending ? "Starting..." : "Generate"}
        </button>
      </div>
      {uploadError && (
        <p className="mt-1 text-xs text-red-500">{uploadError}</p>
      )}
      {launchRun.isError && (
        <p className="mt-1 text-xs text-red-500">
          {(launchRun.error as Error).message}
        </p>
      )}
    </div>
  );
}

function GenerateCvCard() {
  const documentsQuery = useDocuments();
  const upload = useUploadDocument();
  const files = documentsQuery.data?.cv ?? [];

  return (
    <GenerateFromUploadCard
      title="CV from resume"
      description={
        <>
          Regenerates <code>cv/main_example.tex</code> from an uploaded resume,
          without redoing the rest of your profile.
        </>
      }
      files={files}
      accept=".pdf,.tex"
      chooseLabel="Choose a resume..."
      noFilesLabel="No resumes uploaded yet"
      uploadButtonLabel="Upload resume"
      uploadPending={upload.isPending}
      uploadError={upload.isError ? (upload.error as Error).message : null}
      onUpload={(file, onSuccess) =>
        upload.mutate(
          { folder: "cv", file },
          { onSuccess: (res) => onSuccess(res.filename) },
        )
      }
      buildLaunchArgs={(filename) => ({
        command: "/setup",
        args: `--section cv documents/cv/${filename}`,
      })}
    />
  );
}

const COVER_LETTER_SAMPLES_CATEGORY = "cover-letter-samples";

function GenerateCoverLetterCard() {
  const uploadsQuery = useUploads(COVER_LETTER_SAMPLES_CATEGORY);
  const upload = useUploadFile();
  const files = uploadsQuery.data ?? [];

  return (
    <GenerateFromUploadCard
      title="Cover letter template from an example"
      description={
        <>
          Turns a cover letter you like the structure of (yours or a sample, any
          format) into a new named template <code>/apply</code> can use, without
          touching the stock <code>cover_example.tex</code>.
        </>
      }
      files={files}
      accept=".pdf,.docx,.txt,.md,.tex"
      chooseLabel="Choose an example..."
      noFilesLabel="No examples uploaded yet"
      uploadButtonLabel="Upload example"
      uploadPending={upload.isPending}
      uploadError={upload.isError ? (upload.error as Error).message : null}
      onUpload={(file, onSuccess) =>
        upload.mutate(
          { category: COVER_LETTER_SAMPLES_CATEGORY, file },
          { onSuccess: (res) => onSuccess(res.filename) },
        )
      }
      buildLaunchArgs={(filename) => {
        const path = `dashboard/server/.uploads/${COVER_LETTER_SAMPLES_CATEGORY}/${filename}`;
        return {
          command: "/add-template",
          args: `${path} - this is a non-LaTeX cover letter example (not a LaTeX template). Follow Step 1.5 to extract its structure and register a new cover letter template from it.`,
        };
      }}
    />
  );
}

function ExpandProfile() {
  const launchRun = useLaunchRun();
  const navigate = useNavigate();

  const runExpand = () => {
    launchRun.mutate(
      { command: "/expand" },
      { onSuccess: ({ runId }) => navigate(`/runs/${runId}`) },
    );
  };

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <InlineSectionHeading>Expand profile</InlineSectionHeading>
          <p className="mt-0.5 text-xs text-muted">
            Scans public sources already linked in your profile (GitHub,
            portfolio, Kaggle, Google Scholar) and named courses/certifications,
            then adds any competencies it finds, source-tagged, below.
          </p>
        </div>
        <button
          onClick={runExpand}
          disabled={launchRun.isPending}
          className="shrink-0 rounded-full border border-border/15 px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
          {launchRun.isPending ? "Starting..." : "Run /expand"}
        </button>
      </div>
    </section>
  );
}

function GenerateTemplates() {
  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <InlineSectionHeading>Generate templates</InlineSectionHeading>
      <p className="mt-0.5 text-xs text-muted">
        Not a built-in ai-job-search workflow, added here for convenience: turn
        a document you upload into a template file, then launch the run that
        builds it.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <GenerateCvCard />
        <GenerateCoverLetterCard />
      </div>
    </section>
  );
}

function SectionItem({
  section,
  index,
  file,
}: {
  section: MarkdownSection;
  index: number;
  file: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);
  const updateSection = useUpdateProfileSection();
  const HeadingTag =
    `h${Math.min(section.level + 1, 6)}` as keyof JSX.IntrinsicElements;

  const startEditing = () => {
    setDraft(section.content);
    setEditing(true);
  };

  const handleSave = () => {
    updateSection.mutate(
      { file, sectionIndex: index, content: draft },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <div className="group/section">
      <div className="flex items-start justify-between gap-2">
        <HeadingTag
          className={
            section.level <= 2
              ? "mb-1 mt-4 text-base font-bold tracking-tight text-ink"
              : "mb-1 mt-3 text-sm font-semibold text-ink/90"
          }
        >
          {section.heading}
        </HeadingTag>
        {!editing && (
          <button
            onClick={startEditing}
            className="mt-4 shrink-0 rounded-full border border-border/15 px-2.5 py-0.5 text-[11px] font-medium text-muted transition-opacity hover:border-signal/30 hover:text-signal lg:opacity-0 lg:group-hover/section:opacity-100"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2 pb-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(20, Math.max(4, draft.split("\n").length + 1))}
            className={textareaClass}
            autoFocus
          />
          {updateSection.isError && (
            <p className="text-xs text-red-500">
              {(updateSection.error as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateSection.isPending}
              className="rounded-full bg-signal px-3 py-1 text-xs font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {updateSection.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={updateSection.isPending}
              className="rounded-full border border-border/15 px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-signal/30 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        section.content && <Markdown>{section.content}</Markdown>
      )}
    </div>
  );
}

function SectionList({
  sections,
  file,
}: {
  sections: MarkdownSection[];
  file: string;
}) {
  return (
    <div className="flex flex-col">
      {sections.map((section, i) => (
        <SectionItem key={i} section={section} index={i} file={file} />
      ))}
    </div>
  );
}

export default function Profile() {
  const profileQuery = useProfile();
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  return (
    <QueryState query={profileQuery}>
      {() => {
        const profile = profileQuery.data;
        if (!profile) return null;

        return (
          <div className="flex flex-col gap-5">
            <PageHeader
              title="Profile"
              subtitle="What Claude knows about you. Hover any section below and click Edit to change it, no text editor needed."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section
                className={`rounded-3xl border p-4 ${
                  profile.placeholders.length === 0
                    ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                    : "border-amber-500/30 bg-amber-500/[0.07]"
                }`}
              >
                {profile.placeholders.length === 0 ? (
                  <p className="text-sm font-medium text-emerald-500">
                    Profile setup looks complete. No placeholder tokens left in
                    CLAUDE.md or the profile skill files.
                  </p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
                      {profile.placeholders.length} placeholder token
                      {profile.placeholders.length === 1 ? "" : "s"} still in
                      your profile. Run <code>/setup</code>, or edit inline
                      below, to fill{" "}
                      {profile.placeholders.length === 1 ? "it" : "them"} in.
                    </p>
                    <ul className="mt-2 flex flex-col gap-0.5 text-xs text-amber-700/80 dark:text-amber-500/80">
                      {profile.placeholders.slice(0, 8).map((hit, i) => (
                        <li key={i}>
                          {hit.file}:{hit.line}: <code>{hit.match}</code>
                        </li>
                      ))}
                      {profile.placeholders.length > 8 && (
                        <li>...and {profile.placeholders.length - 8} more.</li>
                      )}
                    </ul>
                  </div>
                )}
              </section>

              <ExpandProfile />
            </div>

            <ImportDocuments />

            <GenerateTemplates />

            <section className="rounded-3xl border border-border/10 bg-surface p-5">
              <SectionList
                sections={profile.claudeMdSections}
                file="CLAUDE.md"
              />
            </section>

            <div className="flex flex-col gap-2">
              <InlineSectionHeading>Framework files</InlineSectionHeading>
              {profile.skillFiles.map((file) => {
                const isOpen = openFiles.has(file.filename);
                return (
                  <section
                    key={file.filename}
                    className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm"
                  >
                    <button
                      className="flex w-full items-center justify-between text-left text-sm font-medium text-ink/90"
                      onClick={() =>
                        setOpenFiles((prev) => {
                          const next = new Set(prev);
                          if (next.has(file.filename))
                            next.delete(file.filename);
                          else next.add(file.filename);
                          return next;
                        })
                      }
                    >
                      {file.filename}
                      <span className="text-xs text-muted">
                        {isOpen ? "Hide ▲" : "Show ▼"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-3 border-t border-border/10 pt-3">
                        <SectionList
                          sections={file.sections}
                          file={file.filename}
                        />
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}
