import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CareSectionHeader } from "@/components/care/CareUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCareFinance, saveCareFinanceSettings } from "@/lib/care-finance.functions";
import { useDemoRole } from "@/lib/demo-role";

export const Route = createFileRoute("/_authenticated/v/f/$slug/ekonomi")({
  head: () => ({
    meta: [
      { title: "Ekonomi – Alfa 1.0 Vård" },
      {
        name: "description",
        content: "Intäkter, personalkostnad, resor och resultat per månad för hemtjänsten.",
      },
      { property: "og:title", content: "Ekonomi – Alfa 1.0 Vård" },
      {
        property: "og:description",
        content: "Fakturaunderlag per brukare och kostnad per anställd i hemtjänstverksamheten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function kr(v: number) {
  return `${v.toLocaleString("sv-SE")} kr`;
}

function FinancePage() {
  const { slug } = Route.useParams();
  const { role } = useDemoRole();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());

  const fetchFinance = useServerFn(getCareFinance);
  const saveSettings = useServerFn(saveCareFinanceSettings);

  const q = useQuery({
    queryKey: ["care-finance", slug, month],
    queryFn: () => fetchFinance({ data: { slug, month } }),
    enabled: role === "admin",
  });

  const [rate, setRate] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [travel, setTravel] = useState<string>("");

  const persist = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          slug,
          hourly_rate: Number(rate || q.data?.settings.hourly_rate || 0),
          staff_cost_per_hour: Number(cost || q.data?.settings.staff_cost_per_hour || 0),
          travel_cost_per_km: Number(travel || q.data?.settings.travel_cost_per_km || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Priserna är sparade.");
      void qc.invalidateQueries({ queryKey: ["care-finance", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "admin") {
    return (
      <p className="rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm text-muted-foreground">
        Ekonomi visas bara för verksamhetsadmin.
      </p>
    );
  }

  const data = q.data;

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Typ", "Namn", "Besök", "Uteblivna", "Timmar", "Km", "Belopp"],
      ...data.clients.map((c) => [
        "Brukare",
        c.name,
        c.visits,
        c.missed,
        c.hours,
        c.km,
        c.amount,
      ]),
      ...data.staff.map((s) => ["Personal", s.name, s.visits, s.missed, s.hours, s.km, s.amount]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekonomi-${slug}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <CareSectionHeader
        icon={<Wallet className="h-5 w-5" aria-hidden />}
        title="Ekonomi"
        subtitle="Intäkter, kostnader och resultat för verksamheten – månad för månad."
        action={
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40"
              aria-label="Månad"
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </Button>
          </div>
        }
      />

      {q.isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Räknar…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Intäkt" value={kr(data.totals.revenue)} hint={`${data.totals.done} utförda besök`} />
            <Card label="Personalkostnad" value={kr(data.totals.staffCost)} hint={`${data.totals.hours} timmar`} />
            <Card label="Resor" value={kr(data.totals.travelCost)} hint={`${data.totals.km} km`} />
            <Card
              label="Resultat"
              value={kr(data.totals.result)}
              hint={data.totals.missed > 0 ? `${data.totals.missed} uteblivna besök` : "Inga uteblivna besök"}
            />
          </div>

          <section className="rounded-3xl border border-border/70 bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              Resultat per månad
            </h2>
            <div className="mt-4 flex h-32 items-end gap-2">
              {data.trend.map((t) => {
                const max = Math.max(1, ...data.trend.map((x) => Math.abs(x.result)));
                const height = Math.max(4, Math.round((Math.abs(t.result) / max) * 100));
                return (
                  <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-lg ${t.result >= 0 ? "bg-primary/70" : "bg-destructive/70"}`}
                      style={{ height: `${height}%` }}
                      title={`${t.month}: ${kr(t.result)}`}
                    />
                    <span className="text-[10px] text-muted-foreground">{t.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <Table
            title="Fakturaunderlag per brukare"
            rows={data.clients}
            amountLabel="Att fakturera"
          />
          <Table title="Kostnad per anställd" rows={data.staff} amountLabel="Kostnad" />

          <section className="rounded-3xl border border-border/70 bg-card p-5">
            <h2 className="text-sm font-semibold">Priser och ersättning</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field
                id="timpris"
                label="Timpris brukare (kr)"
                value={rate || String(data.settings.hourly_rate)}
                onChange={setRate}
              />
              <Field
                id="timkostnad"
                label="Timkostnad personal (kr)"
                value={cost || String(data.settings.staff_cost_per_hour)}
                onChange={setCost}
              />
              <Field
                id="resa"
                label="Reseersättning per km (kr)"
                value={travel || String(data.settings.travel_cost_per_km)}
                onChange={setTravel}
              />
            </div>
            <Button className="mt-4" disabled={persist.isPending} onClick={() => persist.mutate()}>
              Spara priser
            </Button>
          </section>
        </>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Table({
  title,
  rows,
  amountLabel,
}: {
  title: string;
  rows: Array<{ id: string; name: string; visits: number; missed: number; hours: number; km: number; amount: number }>;
  amountLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      <h2 className="border-b border-border/70 px-5 py-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Inga besök den här månaden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2">Namn</th>
                <th className="px-5 py-2">Besök</th>
                <th className="px-5 py-2">Uteblivna</th>
                <th className="px-5 py-2">Timmar</th>
                <th className="px-5 py-2">Km</th>
                <th className="px-5 py-2">{amountLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-5 py-2 font-medium">{r.name}</td>
                  <td className="px-5 py-2">{r.visits}</td>
                  <td className="px-5 py-2">{r.missed}</td>
                  <td className="px-5 py-2">{r.hours}</td>
                  <td className="px-5 py-2">{r.km}</td>
                  <td className="px-5 py-2">{kr(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
