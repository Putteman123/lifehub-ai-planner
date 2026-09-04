import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, HelpCircle, PlugZap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ingestDiagnostics, testIngest } from "@/lib/places.functions";
import { timeLocal } from "@/lib/tz";

const OUTCOME_LABEL: Record<string, string> = {
  ok: "Position mottagen",
  fel_nyckel: "Fel nyckel i adressen",
  ingen_nyckel: "Ingen nyckel i adressen",
  ogiltig_json: "Kunde inte läsa innehållet",
  annan_typ: "Annat meddelande (ignorerat)",
  ingen_agare: "Hittade ingen ägare",
  saknar_nyckel_server: "Nyckeln saknas i appen",
  get_test: "Test av adressen",
};

const VERDICT: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  ok: {
    text: "Telefonen når fram och positioner sparas.",
    tone: "ok",
  },
  fel_nyckel: {
    text: "Telefonen når fram, men adressen saknar rätt nyckel. Kopiera adressen nedan igen – hela raden, inklusive allt efter frågetecknet.",
    tone: "warn",
  },
  fel_format: {
    text: "Telefonen når fram, men skickar inget som innehåller en position. Kontrollera att OwnTracks står i HTTP-läge.",
    tone: "warn",
  },
  ingen_kontakt: {
    text: "Ingenting har nått fram från telefonen. Då är det adressen i OwnTracks som är fel, eller så står appen kvar i MQTT-läge.",
    tone: "bad",
  },
};

/** Visar om telefonens positioner överhuvudtaget når fram till appen. */
export function ConnectionCheckCard() {
  const diag = useServerFn(ingestDiagnostics);
  const test = useServerFn(testIngest);

  const q = useQuery({
    queryKey: ["ingest_diagnostics"],
    queryFn: () => diag({}),
    refetchInterval: 60000,
  });

  const runTest = useMutation({
    mutationFn: () => test({}),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      void q.refetch();
    },
  });

  const verdict = VERDICT[q.data?.verdict ?? "ingen_kontakt"]!;
  const tone =
    verdict.tone === "ok"
      ? "bg-emerald-500/10 text-emerald-600"
      : verdict.tone === "warn"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-destructive/10 text-destructive";

  return (
    <section className="rounded-[18px] border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PlugZap className="size-4 text-primary" /> Anslutningskontroll
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
            <RefreshCw className="size-4" /> Uppdatera
          </Button>
          <Button size="sm" onClick={() => runTest.mutate()} disabled={runTest.isPending}>
            Testa adressen
          </Button>
        </div>
      </div>

      <div className={`mt-3 flex gap-2 rounded-2xl p-3 text-sm ${tone}`}>
        {q.data?.verdict === "ok" ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        )}
        <p>{q.isLoading ? "Kontrollerar…" : verdict.text}</p>
      </div>

      {q.data?.lastAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Senaste anrop {timeLocal(q.data.lastAt)} ·{" "}
          {OUTCOME_LABEL[q.data.lastOutcome ?? ""] ?? q.data.lastOutcome}
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <HelpCircle className="size-3.5" /> Inga anrop har registrerats än.
        </p>
      )}

      {q.data?.recent?.length ? (
        <ul className="mt-3 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          {q.data.recent.map((r, i) => (
            <li key={`${r.at}-${i}`} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {OUTCOME_LABEL[r.outcome] ?? r.outcome}
                {r.detail ? ` · ${r.detail}` : ""}
              </span>
              <span className="shrink-0 tabular-nums">{timeLocal(r.at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
