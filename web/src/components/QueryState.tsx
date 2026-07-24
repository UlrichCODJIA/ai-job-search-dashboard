import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

interface QueryLike {
  isLoading: boolean;
  isError: boolean;
}

/** Gates rendering on one or more TanStack Query results, replacing the
 * `if (query.isLoading) return ...; if (query.isError) return ...;` guard
 * copy-pasted at the top of most pages. Pass an array when a page depends on
 * more than one query (e.g. Overview.tsx's jobs + tracker) -- any query
 * loading shows the loading state, any query erroring shows the error state.
 *
 * `loadingFallback`/`errorFallback` let a page substitute its own presentation
 * (Settings.tsx's inline guards use a plainer error message than the standard
 * EmptyState) while still sharing the branching logic itself. */
export function QueryState({
  query,
  loadingFallback,
  errorFallback,
  children,
}: {
  query: QueryLike | QueryLike[];
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  children: () => ReactNode;
}) {
  const queries = Array.isArray(query) ? query : [query];

  if (queries.some((q) => q.isLoading)) {
    return <>{loadingFallback ?? <p className="text-sm text-muted">Loading...</p>}</>;
  }

  if (queries.some((q) => q.isError)) {
    return (
      <>
        {errorFallback ?? (
          <EmptyState
            title="Couldn't reach the dashboard server"
            description="Make sure the server is running (`bun run dev` from dashboard/)."
          />
        )}
      </>
    );
  }

  return <>{children()}</>;
}
