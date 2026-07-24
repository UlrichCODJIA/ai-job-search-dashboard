import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import {
  queryKeys,
  useCreateSalaryCompany,
  useDeleteSalaryCompany,
  useSalaryData,
  useSalaryStatus,
  useUpdateSalaryCompany,
  useUpdateSalaryMetadata,
} from "../api/queries";
import type { SalaryCategory, SalaryCompanyEntry, SalaryMetadata } from "../api/types";
import { Drawer } from "../components/Drawer";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { QueryState } from "../components/QueryState";
import { useConfirm } from "../hooks/useConfirm";
import { inputClass, outlineButtonClass, primaryButtonClass } from "../lib/ui";

interface SalaryCompanySearchEntry {
  company: string;
  city?: string;
  categories?: Record<string, { count?: number; index?: number }>;
}

function vsBaseline(index: number | undefined, baseline: number): string {
  if (index == null || Number.isNaN(baseline) || baseline === 0) return "N/A";
  const diff = (((index - baseline) / baseline) * 100).toFixed(1);
  return `${diff}%`;
}

function CompanyCard({
  entry,
  baseline,
  actions,
}: {
  entry: SalaryCompanyEntry;
  baseline: number;
  actions?: ReactNode;
}) {
  const categories = entry.categories ?? {};
  const hasCategories = Object.keys(categories).length > 0;
  return (
    <div className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-ink">
          {entry.company}
          {entry.city ? <span className="ml-2 text-xs font-sans font-normal text-muted">{entry.city}</span> : null}
        </h2>
        {actions}
      </div>
      {hasCategories ? (
        <div className="thin-scrollbar mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-border/10">
                <th className="whitespace-nowrap py-1.5 pr-3">Category</th>
                <th className="whitespace-nowrap py-1.5 pr-3">Count</th>
                <th className="whitespace-nowrap py-1.5 pr-3">Index</th>
                <th className="whitespace-nowrap py-1.5">vs baseline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {Object.entries(categories).map(([name, cat]) => (
                <tr key={name}>
                  <td className="whitespace-nowrap py-1.5 pr-3 font-medium text-ink">{name}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-muted">{cat.count ?? "N/A*"}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-muted">{cat.index ?? "N/A"}</td>
                  <td className="whitespace-nowrap py-1.5 text-muted">{vsBaseline(cat.index, baseline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">No category data for this company.</p>
      )}
    </div>
  );
}

interface CategoryRowState {
  key: string;
  label: string;
  count: string;
  index: string;
}

function emptyRow(): CategoryRowState {
  return { key: crypto.randomUUID(), label: "", count: "", index: "" };
}

function categoriesToRows(categories?: Record<string, SalaryCategory>): CategoryRowState[] {
  if (!categories) return [];
  return Object.entries(categories).map(([label, cat]) => ({
    key: crypto.randomUUID(),
    label,
    count: cat.count != null ? String(cat.count) : "",
    index: cat.index != null ? String(cat.index) : "",
  }));
}

function rowsToCategories(rows: CategoryRowState[]): Record<string, SalaryCategory> | undefined {
  const result: Record<string, SalaryCategory> = {};
  for (const row of rows) {
    if (!row.label.trim()) continue;
    const cat: SalaryCategory = {};
    if (row.count.trim()) cat.count = Number(row.count);
    if (row.index.trim()) cat.index = Number(row.index);
    result[row.label.trim()] = cat;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function CompanyFormDrawer({
  entry,
  open,
  onOpenChange,
}: {
  entry: SalaryCompanyEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = entry !== null;
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [rows, setRows] = useState<CategoryRowState[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const createCompany = useCreateSalaryCompany();
  const updateCompany = useUpdateSalaryCompany();

  useEffect(() => {
    if (!open) return;
    setCompany(entry?.company ?? "");
    setCity(entry?.city ?? "");
    const initial = categoriesToRows(entry?.categories);
    setRows(initial.length > 0 ? initial : [emptyRow()]);
    setValidationError(null);
    createCompany.reset();
    updateCompany.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  const updateRow = (i: number, patch: Partial<CategoryRowState>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const isPending = isEdit ? updateCompany.isPending : createCompany.isPending;
  const mutationError = (isEdit ? updateCompany.error : createCompany.error) as Error | null;
  const error = validationError ?? mutationError?.message;

  const handleSubmit = () => {
    for (const row of rows) {
      if (!row.label.trim()) continue;
      const label = row.label.trim();
      if (row.count.trim() && !Number.isFinite(Number(row.count))) {
        setValidationError(`"${label}" has a non-numeric count: "${row.count}".`);
        return;
      }
      if (row.index.trim() && !Number.isFinite(Number(row.index))) {
        setValidationError(`"${label}" has a non-numeric salary/index: "${row.index}".`);
        return;
      }
    }
    setValidationError(null);
    const payload: SalaryCompanyEntry = {
      company: company.trim(),
      city: city.trim() || undefined,
      categories: rowsToCategories(rows),
    };
    if (isEdit && entry) {
      updateCompany.mutate({ originalName: entry.company, entry: payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createCompany.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={isEdit ? `Edit ${entry?.company}` : "Add company"}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Company name</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company name"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">City (optional)</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Categories</label>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-1.5">
                <input
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="e.g. engineering"
                  className={`min-w-0 flex-1 ${inputClass}`}
                />
                <input
                  value={row.count}
                  onChange={(e) => updateRow(i, { count: e.target.value })}
                  placeholder="Count"
                  inputMode="numeric"
                  className={`w-16 ${inputClass}`}
                />
                <input
                  value={row.index}
                  onChange={(e) => updateRow(i, { index: e.target.value })}
                  placeholder="Salary/index"
                  inputMode="numeric"
                  className={`w-24 ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remove category"
                  className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addRow} className={`self-start shrink-0 ${outlineButtonClass}`}>
              + Add category
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="border-t border-border/10 pt-4">
          <button onClick={handleSubmit} disabled={isPending || !company.trim()} className={primaryButtonClass}>
            {isPending ? "Saving..." : isEdit ? "Save changes" : "Add company"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function MetadataEditor({ metadata }: { metadata: SalaryMetadata }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(metadata.source ?? "");
  const [baseline, setBaseline] = useState(String(metadata.index_baseline ?? 0));
  const [label, setLabel] = useState(metadata.index_label ?? "");
  const [description, setDescription] = useState(metadata.baseline_description ?? "");
  // Tracks whether the user has unsaved edits, so a background refetch (another
  // company add/edit/delete invalidating salary data, or refetchOnWindowFocus)
  // doesn't wipe out what they're mid-typing here -- this component is always
  // mounted, so it can't rely on a remount key like CompanyFormDrawer's `open`.
  const [dirty, setDirty] = useState(false);
  const updateMetadata = useUpdateSalaryMetadata();

  useEffect(() => {
    if (dirty) return;
    setSource(metadata.source ?? "");
    setBaseline(String(metadata.index_baseline ?? 0));
    setLabel(metadata.index_label ?? "");
    setDescription(metadata.baseline_description ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata]);

  const handleSave = () => {
    updateMetadata.mutate(
      {
        source,
        index_baseline: Number(baseline) || 0,
        index_label: label,
        baseline_description: description,
      },
      {
        onSuccess: (data) => {
          setDirty(false);
          setSource(data.metadata.source ?? "");
          setBaseline(String(data.metadata.index_baseline ?? 0));
          setLabel(data.metadata.index_label ?? "");
          setDescription(data.metadata.baseline_description ?? "");
        },
      },
    );
  };

  return (
    <section className="rounded-3xl border border-border/10 bg-surface p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <h2 className="text-sm font-bold tracking-tight text-ink">Baseline settings</h2>
        <span className="text-xs text-muted">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={source}
            onChange={(e) => {
              setDirty(true);
              setSource(e.target.value);
            }}
            placeholder="Source (e.g. Union statistics 2026)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={baseline}
              onChange={(e) => {
                setDirty(true);
                setBaseline(e.target.value);
              }}
              placeholder="Baseline value"
              inputMode="numeric"
              className={`w-32 ${inputClass}`}
            />
            <input
              value={label}
              onChange={(e) => {
                setDirty(true);
                setLabel(e.target.value);
              }}
              placeholder="Index label"
              className={`flex-1 ${inputClass}`}
            />
          </div>
          <input
            value={description}
            onChange={(e) => {
              setDirty(true);
              setDescription(e.target.value);
            }}
            placeholder="Baseline description"
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={updateMetadata.isPending} className={`self-start ${primaryButtonClass}`}>
              {updateMetadata.isPending ? "Saving..." : "Save baseline settings"}
            </button>
            {updateMetadata.isSuccess && <span className="text-xs text-emerald-500">Saved</span>}
            {updateMetadata.isError && (
              <span className="text-xs text-red-500">{(updateMetadata.error as Error).message}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Salary() {
  const statusQuery = useSalaryStatus();
  const salaryDataQuery = useSalaryData();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [formEntry, setFormEntry] = useState<SalaryCompanyEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const confirmDelete = useConfirm<string>();
  const deleteCompany = useDeleteSalaryCompany();

  const searchQuery = useQuery({
    queryKey: queryKeys.salarySearch(submitted),
    queryFn: () => api.salary.search(submitted) as Promise<SalaryCompanySearchEntry[]>,
    enabled: submitted.length > 0,
  });

  const status = statusQuery.data;
  const baseline = Number(status?.metadata?.index_baseline ?? NaN);
  const companies = salaryDataQuery.data?.companies ?? [];
  const metadata = salaryDataQuery.data?.metadata ?? {};

  const openAddForm = () => {
    setFormEntry(null);
    setFormOpen(true);
  };
  const openEditForm = (entry: SalaryCompanyEntry) => {
    setFormEntry(entry);
    setFormOpen(true);
  };
  const handleDeleteClick = (name: string) => {
    if (!confirmDelete.isArmed(name)) {
      confirmDelete.arm(name);
      return;
    }
    deleteCompany.mutate(name, { onSuccess: () => confirmDelete.disarm() });
  };

  return (
    <QueryState query={[statusQuery, salaryDataQuery]}>
      {() => (
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Salary"
            subtitle="Benchmark a company against your salary data, and manage that data right here, no manual file editing needed."
          />

          {!status?.available ? (
            <EmptyState
              title="No salary data configured"
              description="Add your first company below to get started, or add salary_data.json at the repo root yourself (see tools/README_SALARY_TOOL.md). The /apply workflow skips this step gracefully until then."
              action={
                <button onClick={openAddForm} className={primaryButtonClass}>
                  Add your first company
                </button>
              }
            />
          ) : (
            <>
              <p className="text-xs text-muted">
                {status.companyCount} {status.companyCount === 1 ? "company" : "companies"} indexed
                {status.metadata?.source ? ` from ${String(status.metadata.source)}` : ""}.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(query.trim());
                }}
                className="flex gap-2"
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company name..."
                  className={`w-72 ${inputClass}`}
                />
                <button
                  type="submit"
                  className="rounded-full bg-signal px-3.5 py-1.5 text-sm font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97]"
                >
                  Search
                </button>
              </form>

              {searchQuery.isFetching && <p className="text-sm text-muted">Searching...</p>}
              {searchQuery.isError && (
                <p className="text-sm text-red-500">{(searchQuery.error as Error).message}</p>
              )}
              {searchQuery.data && searchQuery.data.length === 0 && (
                <p className="text-sm text-muted">No matching company found.</p>
              )}
              {searchQuery.data?.map((entry) => (
                <CompanyCard key={entry.company} entry={entry} baseline={baseline} />
              ))}
              {status.metadata?.baseline_description && (
                <p className="text-xs text-muted">{String(status.metadata.baseline_description)}</p>
              )}
            </>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-ink">Manage companies</h2>
              <button onClick={openAddForm} className={`shrink-0 ${outlineButtonClass}`}>
                + Add company
              </button>
            </div>
            {companies.length === 0 ? (
              <EmptyState
                title="No companies yet"
                description="Add one above to get started."
                action={
                  <button onClick={openAddForm} className={primaryButtonClass}>
                    Add your first company
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {companies.map((entry) => (
                  <CompanyCard
                    key={entry.company}
                    entry={entry}
                    baseline={baseline}
                    actions={
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => openEditForm(entry)} className={`shrink-0 ${outlineButtonClass}`}>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry.company)}
                          disabled={deleteCompany.isPending}
                          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            confirmDelete.isArmed(entry.company)
                              ? "border-red-500/40 bg-red-500/10 text-red-500"
                              : "border-border/15 text-muted hover:border-red-500/30 hover:text-red-400"
                          }`}
                        >
                          {confirmDelete.isArmed(entry.company) ? "Confirm?" : "Delete"}
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
            {deleteCompany.isError && (
              <p className="text-xs text-red-500">{(deleteCompany.error as Error).message}</p>
            )}
          </section>

          {status?.available && <MetadataEditor metadata={metadata} />}

          <CompanyFormDrawer entry={formEntry} open={formOpen} onOpenChange={setFormOpen} />
        </div>
      )}
    </QueryState>
  );
}
