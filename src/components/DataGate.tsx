import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

const TRANSIENT_HINTS = [
  "failed to fetch",
  "networkerror",
  "load failed",
  "timeout",
  "timed out",
  "503",
  "502",
  "504",
  "upstream",
  "temporar",
  "unavailable",
];

function isTransient(message: string) {
  const m = message.toLowerCase();
  return TRANSIENT_HINTS.some((hint) => m.includes(hint));
}

/**
 * Wraps data-driven page content:
 * - shows a skeleton while loading
 * - after 6s of loading shows a delayed fallback with a manual retry
 * - shows a clear error view with a "Försök igen" button when a query fails
 */
export function DataGate({
  queries,
  children,
}: {
  queries: Pick<UseQueryResult, "isLoading" | "isFetching" | "error" | "refetch">[];
  children: ReactNode;
}) {
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.find((q) => q.error);
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, [loading]);

  async function retry() {
    setRetrying(true);
    try {
      await Promise.all(queries.map((q) => q.refetch()));
    } finally {
      setRetrying(false);
    }
  }

  if (failed?.error) {
    const message = failed.error.message || "Okänt fel";
    const transient = isTransient(message);
    return (
      <div className="card-soft mx-auto mt-6 max-w-md p-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="mt-3 text-base font-semibold">
          {transient ? "Tillfälligt problem med anslutningen" : "Kunde inte hämta data"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {transient
            ? "Servern svarade inte just nu. Det är oftast övergående – försök igen om en liten stund."
            : message}
        </p>
        <Button className="mt-4" onClick={retry} disabled={retrying}>
          {retrying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Försök igen
        </Button>
        {transient ? (
          <p className="mt-3 text-xs text-muted-foreground">Teknisk info: {message}</p>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card-soft h-28 animate-pulse bg-muted/50" />
          ))}
        </div>
        {slow ? (
          <div className="card-soft mx-auto max-w-md p-5 text-center">
            <p className="text-sm font-medium">Det tar längre tid än vanligt</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Anslutningen till servern är trög just nu. Du kan vänta lite till eller försöka igen.
            </p>
            <Button variant="outline" className="mt-3" onClick={retry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Försök igen
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
