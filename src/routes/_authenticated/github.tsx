import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { getGithubOverview } from "@/lib/github-overview.functions";
import type { GhItem } from "@/lib/github-overview.server";
import { getCareContext } from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/github")({
  head: () => ({
    meta: [
      { title: "GitHub – livo.health superadmin" },
      { name: "description", content: "Skrivskyddad översikt över appens GitHub-repo." },
      { property: "og:title", content: "GitHub – livo.health superadmin" },
      { property: "og:description", content: "Skrivskyddad översikt över appens GitHub-repo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GithubView,
});

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "";
}

function List({ title, items, empty }: { title: string; items: GhItem[]; empty: string }) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5">
      <h2 className="font-display text-lg font-semibold">
        {title} <span className="text-sm text-muted-foreground">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {items.map((i) => (
            <li key={i.id + i.url} className="py-2">
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
                <span className="mr-2 font-mono text-xs text-muted-foreground">{i.id}</span>
                {i.title}
              </a>
              <p className="text-xs text-muted-foreground">{[i.meta, fmt(i.date)].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GithubView() {
  const fetchContext = useServerFn(getCareContext);
  const fetchOverview = useServerFn(getGithubOverview);
  const forceRef = useRef(false);

  const ctxQuery = useQuery({
    queryKey: ["care-context"],
    queryFn: () => fetchContext(),
    staleTime: 60_000,
  });
  const isOwner = ctxQuery.data?.isOwner === true;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["github-overview"],
    queryFn: () => fetchOverview({ data: { force: forceRef.current } }),
    retry: false,
    enabled: isOwner,
  });

  async function refresh() {
    forceRef.current = true;
    try {
      await refetch();
    } finally {
      forceRef.current = false;
    }
  }

  if (ctxQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Kontrollerar behörighet…</p>;
  }
  if (!isOwner) {
    return (
      <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Åtkomst nekad – endast superadmin kan se GitHub-översikten.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">GitHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Skrivskyddad översikt. Kodsynkningen kan bara bekräftas i Lovables Git-inställningar.
          </p>
        </div>
        <Button onClick={refresh} disabled={isFetching}>{isFetching ? "Hämtar…" : "Uppdatera"}</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar från GitHub…</p>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message || "Kunde inte hämta GitHub-data."}
        </p>
      ) : data ? (
        <>
          <section className="rounded-3xl border border-border/70 bg-card p-5">
            <a href={data.repo.url} target="_blank" rel="noopener noreferrer" className="font-display text-lg font-semibold hover:underline">
              {data.repo.fullName}
            </a>
            {data.repo.description ? <p className="mt-1 text-sm text-muted-foreground">{data.repo.description}</p> : null}
            <p className="mt-2 text-sm">Standardgren: <span className="font-mono">{data.repo.defaultBranch}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">Uppdaterad {fmt(data.fetchedAt)}</p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <List title="Senaste commits" items={data.commits} empty="Inga commits hittades." />
            <List title="GitHub Actions" items={data.runs} empty="Inga Actions-körningar finns för repot." />
            <List title="Öppna issues" items={data.issues} empty="Inga öppna issues." />
            <List title="Öppna pull requests" items={data.pulls} empty="Inga öppna pull requests." />
          </div>
        </>
      ) : null}
    </div>
  );
}
