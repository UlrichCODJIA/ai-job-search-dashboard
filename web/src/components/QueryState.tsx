import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";

interface QueryLike {
  isLoading: boolean;
  isError: boolean;
}

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
    return (
      <>
        {loadingFallback ?? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Spinner size={16} className="text-signal" />
            Loading...
          </div>
        )}
      </>
    );
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
