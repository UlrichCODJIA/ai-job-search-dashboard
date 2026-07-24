import clsx from "clsx";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No rows to show.",
  onRowClick,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [rows, sort, columns]);

  // A new filter/search/sort can shrink the row count enough that whatever
  // page the user was on no longer exists -- reset to the first page rather
  // than showing an empty table that looks like the filter matched nothing.
  // Keyed on the row *count* (not the rows array reference) so an unrelated
  // background refetch that returns an equal-length array -- e.g. the
  // window-focus refetch every query here has on by default -- doesn't yank
  // the user back to page 1 while they're browsing further in.
  useEffect(() => {
    setPage(0);
  }, [sortedRows.length, sort]);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageRows = sortedRows.slice(start, start + pageSize);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/10 bg-surface">
      <div className="thin-scrollbar overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "whitespace-nowrap px-3 py-2.5 font-medium",
                    col.sortValue && "cursor-pointer select-none hover:text-signal",
                    col.className,
                  )}
                  onClick={() => {
                    if (!col.sortValue) return;
                    setSort((prev) =>
                      prev?.key === col.key
                        ? { key: col.key, dir: prev.dir === 1 ? -1 : 1 }
                        : { key: col.key, dir: 1 },
                    );
                  }}
                >
                  {col.header}
                  {sort?.key === col.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {pageRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(onRowClick && "cursor-pointer transition-colors hover:bg-surface-2")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx("px-3 py-2.5 align-top", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedRows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border/10 px-3 py-2.5 text-xs text-muted">
          <span>
            {start + 1}-{Math.min(start + pageSize, sortedRows.length)} of {sortedRows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-full border border-border/15 px-2.5 py-1 font-medium transition-colors hover:border-signal/30 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded-full border border-border/15 px-2.5 py-1 font-medium transition-colors hover:border-signal/30 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
