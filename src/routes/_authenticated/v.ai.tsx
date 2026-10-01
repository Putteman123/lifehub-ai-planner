import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, Bot, RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { getAiUsageOverview } from "@/lib/ai-usage.functions";
import type { AiUsageOverview, AiUsageSlice } from "@/lib/ai-usage.server";
import type { AiProvider } from "@/lib/ai-complete.server";
import { getCareContext } from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/v/ai")({
  head: () => ({
    meta: [
      { title: "AI-förbrukning – livo.health superadmin" },
      { name: "description", content: "Skrivskyddad översikt över vilka AI-tjänster som levererar svar." },
      { property: "og:title", content: "AI-förbrukning – livo.health superadmin" },
      { property: "og:description", content: "Skrivskyddad översikt över vilka AI-tjänster som levererar svar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiUsagePage,
});

const PROVIDERS: Array<{ id: AiProvider; label: string; note: string; color: string; dotClass: string }> = [
  { id: "google", label: "Din Google-nyckel", note: "Förstahandsval", color: "var(--chart-5)", dotClass: "bg-chart-5" },
  { id: "openai", label: "ChatGPT", note: "Andrahandsval", color: "var(--chart-1)", dotClass: "bg-chart-1" },
  { id: "perplexity", label: "Perplexity", note: "Tredjehandsval", color: "var(--chart-4)", dotClass: "bg-chart-4" },
  { id: "lovable", label: "Lovable", note: "Sista reserv", color: "var(--chart-2)", dotClass: "bg-chart-2" },
];

function percent(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

function UsageRing({ slice }: { slice: AiUsageSlice }) {
  const chartData = PROVIDERS.map((provider) => ({
    ...provider,
    value: slice.providers[provider.id],
  })).filter((item) => item.value > 0);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]" aria-label={`${slice.total} AI-svar denna månad`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData.length ? chartData : [{ value: 1, color: "var(--muted)" }]}
            dataKey="value"
            innerRadius="68%"
            outerRadius="94%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={3}
            isAnimationActive={false}
          >
            {(chartData.length ? chartData : [{ color: "var(--muted)" }]).map((item, index) => (
              <Cell key={index} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <strong className="font-display text-4xl font-semibold">{slice.total}</strong>
        <span className="text-xs text-muted-foreground">AI-svar denna månad</span>
      </div>
    </div>
  );
}

function Period({ label, slice }: { label: string; slice: AiUsageSlice }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold">{label}</h2>
        <strong className="text-2xl">{slice.total}</strong>
      </div>
      <div className="mt-3 space-y-2">
        {PROVIDERS.map((provider) => (
          <div key={provider.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
            <span className={`size-2.5 rounded-full ${provider.dotClass}`} />
            <span>{provider.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {slice.providers[provider.id]} · {percent(slice.providers[provider.id], slice.total)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ data }: { data: AiUsageOverview }) {
  return (
    <>
      <section className="grid items-center gap-6 rounded-lg border border-border/70 bg-card p-5 md:grid-cols-[minmax(240px,0.8fr)_1.2fr]">
        <UsageRing slice={data.month} />
        <div>
          <h2 className="font-display text-xl font-semibold">Fördelning denna månad</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Endast lyckade, levererade svar räknas. Frågor och svar sparas aldrig i statistiken.
          </p>
          <div className="mt-5 space-y-3">
            {PROVIDERS.map((provider) => (
              <div key={provider.id} className="flex items-center gap-3">
                <span className={`size-3 rounded-full ${provider.dotClass}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="text-xs text-muted-foreground">{provider.note}</p>
                </div>
                <strong className="tabular-nums">{percent(data.month.providers[provider.id], data.month.total)}%</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Period label="Idag" slice={data.today} />
        <Period label="Denna vecka" slice={data.week} />
        <Period label="Denna månad" slice={data.month} />
      </div>

      <section className="rounded-lg border border-border/70 bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Prioriteringsordning</h2>
        <p className="mt-1 text-sm text-muted-foreground">Appen provar tjänsterna uppifrån och ned tills ett svar levereras.</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {PROVIDERS.map((provider, index) => (
            <li key={provider.id} className="relative rounded-lg bg-secondary p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-background text-xs font-semibold">{index + 1}</span>
                <span className="text-sm font-semibold">{provider.label}</span>
              </div>
              <p className="mt-1 pl-8 text-xs text-muted-foreground">{provider.note}</p>
              {index < PROVIDERS.length - 1 ? <ArrowDown className="mx-auto mt-2 size-4 text-muted-foreground sm:hidden" /> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Andrea-chatten använder din Google-nyckel direkt och Lovable som reserv.</p>
      </section>

      <p className="text-xs text-muted-foreground">
        {data.trackingStartedAt
          ? `Registreringen började ${dateTime(data.trackingStartedAt)}. Äldre användning ingår inte.`
          : "Ingen användning har registrerats ännu. Äldre användning kan inte återskapas."}
        {` Senast uppdaterad ${dateTime(data.fetchedAt)}.`}
      </p>
    </>
  );
}

function AiUsagePage() {
  const fetchContext = useServerFn(getCareContext);
  const fetchUsage = useServerFn(getAiUsageOverview);
  const contextQuery = useQuery({ queryKey: ["care-context"], queryFn: () => fetchContext({}) });
  const isOwner = contextQuery.data?.isOwner === true;
  const usageQuery = useQuery({
    queryKey: ["ai-usage-overview"],
    queryFn: () => fetchUsage(),
    enabled: isOwner,
    retry: false,
  });

  if (contextQuery.isLoading) return <p className="text-sm text-muted-foreground">Kontrollerar behörighet…</p>;
  if (!isOwner) {
    return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Åtkomst nekad – endast superadmin kan se AI-förbrukningen.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Bot className="size-6 text-primary" /> AI-förbrukning</h1>
          <p className="mt-1 text-sm text-muted-foreground">Se vilken AI-tjänst som faktiskt levererar appens svar.</p>
        </div>
        <Button variant="outline" onClick={() => void usageQuery.refetch()} disabled={usageQuery.isFetching}>
          <RefreshCw className={`size-4 ${usageQuery.isFetching ? "animate-spin" : ""}`} /> Uppdatera
        </Button>
      </div>

      {usageQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar AI-förbrukning…</p>
      ) : usageQuery.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(usageQuery.error as Error).message || "AI-förbrukningen kunde inte hämtas."}
        </p>
      ) : usageQuery.data ? <Dashboard data={usageQuery.data} /> : null}
    </div>
  );
}