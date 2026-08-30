import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink, FileText, Mail, Receipt, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { financeSignedUrl, useFinanceFiles, useSpends } from "@/lib/finance";
import { useMailFindings } from "@/lib/mail-findings";

export const Route = createFileRoute("/_authenticated/arkiv")({
  head: () => ({
    meta: [
      { title: "Arkiv – LifeHub AI" },
      {
        name: "description",
        content: "Sök bland kvitton, fakturor, uppladdade filer och fynd från inkorgen.",
      },
      { property: "og:title", content: "Arkiv – LifeHub AI" },
      {
        property: "og:description",
        content: "Ett sökbart dokumentarkiv för kvitton, fakturor och filer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchivePage,
});

type Kind = "alla" | "filer" | "kvitton" | "mail";

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Entry = {
  id: string;
  kind: Exclude<Kind, "alla">;
  title: string;
  subtitle: string;
  date: string;
  amount: number | null;
  path?: string;
};

function ArchivePage() {
  const filesQ = useFinanceFiles();
  const spendsQ = useSpends();
  const findingsQ = useMailFindings();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("alla");

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    for (const f of filesQ.data ?? []) {
      out.push({
        id: `file-${f.id}`,
        kind: "filer",
        title: f.caption?.trim() || f.file_name,
        subtitle: f.kind,
        date: f.created_at,
        amount: null,
        path: f.storage_path,
      });
    }

    for (const s of spendsQ.data ?? []) {
      out.push({
        id: `spend-${s.id}`,
        kind: "kvitton",
        title: s.note?.trim() || "Utgift",
        subtitle: s.category ?? "Okategoriserad",
        date: s.spent_at,
        amount: Number(s.amount),
      });
    }

    for (const m of findingsQ.data ?? []) {
      out.push({
        id: `mail-${m.id}`,
        kind: "mail",
        title: m.subject ?? m.merchant ?? "E-postfynd",
        subtitle: [m.kind, m.sender].filter(Boolean).join(" · "),
        date: m.occurred_at ?? m.created_at,
        amount: m.amount === null ? null : Number(m.amount),
      });
    }

    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [filesQ.data, spendsQ.data, findingsQ.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => (kind === "alla" ? true : e.kind === kind))
      .filter(
        (e) =>
          !needle ||
          e.title.toLowerCase().includes(needle) ||
          e.subtitle.toLowerCase().includes(needle),
      )
      .slice(0, 200);
  }, [entries, q, kind]);

  const total = filtered.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  async function openFile(path: string) {
    try {
      window.open(await financeSignedUrl(path), "_blank", "noopener");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const tabs: { value: Kind; label: string }[] = [
    { value: "alla", label: "Allt" },
    { value: "filer", label: "Filer" },
    { value: "kvitton", label: "Kvitton" },
    { value: "mail", label: "Inkorg" },
  ];

  return (
    <AppShell title="Arkiv" subtitle="Kvitton, fakturor och filer på ett ställe">
      <DataGate queries={[filesQ, spendsQ, findingsQ]}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök på butik, belopp, kategori eller filnamn"
            className="h-12 pl-9"
            aria-label="Sök i arkivet"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setKind(t.value)}
              className={`rounded-full border px-3 py-1 text-xs ${
                kind === t.value
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length} poster{total > 0 ? ` · ${kr(total)}` : ""}
        </p>

        <div className="mt-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="card-soft p-6 text-sm text-muted-foreground">
              Inget matchar sökningen ännu.
            </div>
          ) : (
            filtered.map((e) => {
              const Icon = e.kind === "filer" ? FileText : e.kind === "mail" ? Mail : Receipt;
              return (
                <div key={e.id} className="card-soft flex items-center gap-3 p-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dateFmt.format(new Date(e.date))} · {e.subtitle}
                    </p>
                  </div>
                  {e.amount !== null ? (
                    <span className="shrink-0 text-sm tabular-nums">{kr(e.amount)}</span>
                  ) : null}
                  {e.path ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      onClick={() => openFile(e.path!)}
                      aria-label="Öppna fil"
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </DataGate>
    </AppShell>
  );
}
