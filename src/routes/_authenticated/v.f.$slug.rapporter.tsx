import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, UserRound, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CareStatusBadge } from "@/components/care/CareUI";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "@/lib/geo";
import { getCareReports, type ReportRow, type VisitReportRow } from "@/lib/care-places.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/rapporter")({
  head: () => ({
    meta: [
      { title: "Rapporter – LifeHub Vård" },
      {
        name: "description",
        content: "Besök, timmar, kilometer och punktlighet per medarbetare och brukare.",
      },
      { property: "og:title", content: "Rapporter – LifeHub Vård" },
      {
        property: "og:description",
        content: "Besök, timmar, kilometer och punktlighet per medarbetare och brukare.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const ALL = "__all__";

function ReportsPage() {
  const { slug } = Route.useParams();
  const fetchReports = useServerFn(getCareReports);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [staffId, setStaffId] = useState(ALL);
  const [clientId, setClientId] = useState(ALL);

  const q = useQuery({
    queryKey: ["care-reports", slug, from, to, staffId, clientId],
    queryFn: () =>
      fetchReports({
        data: {
          slug,
          from,
          to,
          staffId: staffId === ALL ? null : staffId,
          clientId: clientId === ALL ? null : clientId,
        },
      }),
  });

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFrom(isoDate(start));
    setTo(isoDate(end));
  };

  const exportCsv = () => {
    if (!q.data) return;
    const header = [
      "Typ",
      "Namn",
      "Besök",
      "Utförda",
      "Uteblivna",
      "Planerade minuter",
      "Faktiska minuter",
      "Kilometer",
      "Restid minuter",
      "Sena starter",
    ];
    const line = (type: string, r: ReportRow) =>
      [
        type,
        r.name,
        r.visits,
        r.done,
        r.missed,
        r.plannedMinutes,
        r.actualMinutes,
        (r.meters / 1000).toFixed(1).replace(".", ","),
        r.travelMinutes,
        r.lateStarts,
      ].join(";");
    const rows = [
      header.join(";"),
      ...q.data.staff.map((r) => line("Personal", r)),
      ...q.data.clients.map((r) => line("Brukare", r)),
      line("Totalt", q.data.totals),
      "",
      "Besöksrapport per brukare",
      "Brukare;Datum;Start;Slut;Besök;Status",
      ...q.data.visitDetails.map((visit) => {
        const start = new Date(visit.startsAt);
        const end = new Date(visit.endsAt);
        const safe = (value: string) => `"${value.replaceAll('"', '""')}"`;
        return [
          safe(visit.clientName),
          isoDate(start),
          start.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
          end.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
          safe(visit.title),
          visit.status,
        ].join(";");
      }),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${slug}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const data = q.data;
  const totals = data?.totals;
  const maxDay = Math.max(1, ...(data?.days ?? []).map((d) => d.visits));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Rapporter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Besök, timmar, kilometer och punktlighet för vald period.
        </p>
      </header>

      <section className="rounded-3xl border border-border/70 bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Från</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Till</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Medarbetare</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alla</SelectItem>
                {(q.data?.staffList ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name ?? "Namnlös"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Brukare</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alla</SelectItem>
                {(q.data?.clientList ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPreset(7)}>
            Senaste veckan
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPreset(30)}>
            Senaste månaden
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!q.data}>
            Exportera CSV
          </Button>
        </div>
      </section>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : !totals || !data ? null : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Besök" value={String(totals.visits)} hint={`${totals.done} utförda · ${totals.missed} uteblivna`} />
            <Stat
              label="Tid hos brukare"
              value={hours(totals.actualMinutes || totals.plannedMinutes)}
              hint={`Planerat ${hours(totals.plannedMinutes)}`}
            />
            <Stat
              label="Körsträcka"
              value={formatDistance(totals.meters)}
              hint={`${totals.travelMinutes} min restid`}
            />
            <Stat
              label="Punktlighet"
              value={
                totals.visits
                  ? `${Math.round(100 - (totals.lateStarts / totals.visits) * 100)} %`
                  : "–"
              }
              hint={`${totals.lateStarts} sena starter · ${data.deviations} avvikelser`}
            />
          </section>

          <section className="rounded-3xl border border-border/70 bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Besök per dag</h2>
            {data.days.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Inga besök i perioden.</p>
            ) : (
              <div className="mt-3 flex h-32 items-end gap-1">
                {data.days.map((d) => (
                  <div key={d.day} className="flex-1" title={`${d.day}: ${d.visits} besök`}>
                    <div
                      className="rounded-t bg-primary/70"
                      style={{ height: `${(d.visits / maxDay) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <ReportTable title="Per medarbetare" rows={data.staff} />
          <ReportTable title="Per brukare" rows={data.clients} />
          <ClientVisitReport visits={data.visitDetails} />
        </>
      )}
    </div>
  );
}

function ClientVisitReport({ visits }: { visits: VisitReportRow[] }) {
  const groups = new Map<string, { name: string; visits: VisitReportRow[] }>();
  for (const visit of visits) {
    const group = groups.get(visit.clientId) ?? { name: visit.clientName, visits: [] };
    group.visits.push(visit);
    groups.set(visit.clientId, group);
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarDays className="size-5 text-primary" />
          Besöksrapport per brukare
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Planerade, utförda och uteblivna besök under vald period.</p>
      </div>
      {groups.size === 0 ? (
        <p className="text-sm text-muted-foreground">Inga besök i perioden.</p>
      ) : (
        [...groups.entries()].map(([clientId, group]) => {
          const done = group.visits.filter((visit) => visit.status === "utfort").length;
          const missed = group.visits.filter((visit) => visit.status === "uteblivet").length;
          const planned = group.visits.length - done - missed;
          return (
            <article key={clientId} className="rounded-lg border border-border/70 bg-card">
              <header className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 font-medium">
                  <UserRound className="size-4 text-primary" />
                  {group.name}
                </h3>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{planned} planerade</span>
                  <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="size-3.5" />{done} utförda</span>
                  <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="size-3.5" />{missed} uteblivna</span>
                </div>
              </header>
              <div className="divide-y divide-border/60">
                {group.visits.map((visit) => {
                  const start = new Date(visit.startsAt);
                  const end = new Date(visit.endsAt);
                  return (
                    <div key={visit.id} className="grid gap-2 p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                      <div className="text-sm">
                        <p className="font-medium">{start.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</p>
                        <p className="text-xs text-muted-foreground">
                          {start.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–{end.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <p className="text-sm">{visit.title}</p>
                      <CareStatusBadge status={visit.status} />
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Inget att visa.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Namn</th>
                <th className="py-2">Besök</th>
                <th className="py-2">Tid</th>
                <th className="py-2">Km</th>
                <th className="py-2">Sena</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2">
                    {r.visits}
                    <span className="text-muted-foreground"> ({r.done} klara)</span>
                  </td>
                  <td className="py-2">{hours(r.actualMinutes || r.plannedMinutes)}</td>
                  <td className="py-2">{formatDistance(r.meters)}</td>
                  <td className="py-2">{r.lateStarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
