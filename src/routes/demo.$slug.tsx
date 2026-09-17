import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  StatGrid,
  StatLine,
  emptyStat,
  type CareStat,
} from "@/components/care/CareStats";
import { getDemoCompany } from "@/lib/care-demo.functions";
import { APP_VERSION } from "@/lib/nav-theme";

export const Route = createFileRoute("/demo/$slug")({
  head: () => ({
    meta: [
      { title: "Demo av Alfa 1.0 – hemtjänstsystem" },
      {
        name: "description",
        content:
          "Skrivskyddad demo av Alfa 1.0: personal, brukare, besök och mediciner med riktiga siffror.",
      },
      { property: "og:title", content: "Demo av Alfa 1.0 – hemtjänstsystem" },
      {
        property: "og:description",
        content:
          "Skrivskyddad demo av Alfa 1.0: personal, brukare, besök och mediciner med riktiga siffror.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

type Member = {
  id: string;
  display_name: string;
  role: string;
  employment: string | null;
  work_hours: string | null;
};
type Client = { id: string; name: string; address: string | null };
type Medication = {
  id: string;
  client_id: string;
  name: string;
  dose: string | null;
  times: string | null;
  requires_delegation: boolean;
};
type Visit = {
  id: string;
  client_id: string | null;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  title: string | null;
};

const statusLabel: Record<string, string> = {
  planerad: "Planerad",
  pagar: "Pågår",
  utfort: "Utförd",
  uteblivet: "Uteblivet",
};

function DemoPage() {
  const { slug } = Route.useParams();
  const fetchDemo = useServerFn(getDemoCompany);
  const [pinInput, setPinInput] = useState("");
  const [pin, setPin] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["care-demo", slug, pin],
    queryFn: () => fetchDemo({ data: { slug, pin: pin! } }),
    enabled: pin !== null,
    retry: false,
  });

  if (pin === null || q.error) {
    return (
      <div className="care-theme mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Demo av Alfa {APP_VERSION.replace("Alfa ", "")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ange pinkoden du fått för att se demoföretaget.
        </p>
        <Input
          inputMode="numeric"
          placeholder="Pinkod"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setPin(pinInput);
          }}
        />
        {q.error ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : null}
        <Button onClick={() => setPin(pinInput)} disabled={pinInput.length < 4}>
          Öppna demon
        </Button>
      </div>
    );
  }

  if (q.isLoading || !q.data) {
    return <p className="p-8 text-sm text-muted-foreground">Hämtar demon…</p>;
  }

  const { org, members, clients, medications, stats, todaysVisits } = q.data;
  const staffStats = stats.staff as Record<string, CareStat>;
  const clientStats = stats.clients as Record<string, CareStat>;
  const nameOf = (id: string | null, list: { id: string; name?: string; display_name?: string }[]) =>
    list.find((x) => x.id === id)?.name ?? list.find((x) => x.id === id)?.display_name ?? "–";

  return (
    <div className="care-theme min-h-screen">
      <header className="border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <span className="font-display font-semibold">{org.name}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
            {APP_VERSION}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Demo · skrivskyddad</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <StatGrid
          stat={stats.total as CareStat}
          days={stats.days}
          extra={[
            { label: "Personal", value: String(members.length) },
            { label: "Brukare", value: String(clients.length) },
            { label: "Mediciner", value: String(medications.length) },
          ]}
        />

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Personal</h2>
          <ul className="space-y-2">
            {(members as Member[]).map((m) => (
              <li key={m.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="font-medium">{m.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.role === "org_admin" ? "Verksamhetsadmin" : "Personal"}
                  {m.employment ? ` · ${m.employment}` : ""}
                  {m.work_hours ? ` · ${m.work_hours}` : ""}
                </p>
                <StatLine stat={staffStats[m.id] ?? emptyStat} />
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Brukare</h2>
          <ul className="space-y-2">
            {(clients as Client[]).map((c) => (
              <li key={c.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.address ?? "Ingen adress"}</p>
                <StatLine stat={clientStats[c.id] ?? emptyStat} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {(medications as Medication[])
                    .filter((m) => m.client_id === c.id)
                    .map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}`)
                    .join(" · ") || "Inga mediciner"}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Dagens besök</h2>
          {todaysVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga besök idag.</p>
          ) : (
            <ul className="space-y-2">
              {(todaysVisits as Visit[]).map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {nameOf(v.client_id, clients as Client[])}
                      {v.title ? ` · ${v.title}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(v.starts_at).toLocaleTimeString("sv-SE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      –
                      {new Date(v.ends_at).toLocaleTimeString("sv-SE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {nameOf(v.staff_id, members as Member[])}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {statusLabel[v.status] ?? v.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
