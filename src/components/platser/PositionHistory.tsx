import { useQuery } from "@tanstack/react-query";
import { ExternalLink, History, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { PingRow } from "@/lib/geo";

const RANGES = [
  { value: "24h", label: "24 tim", hours: 24 },
  { value: "7d", label: "7 dagar", hours: 24 * 7 },
  { value: "30d", label: "30 dagar", hours: 24 * 30 },
] as const;

type RangeValue = (typeof RANGES)[number]["value"];

function stamp(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Enkel historik över de senaste registrerade positionerna. */
export function PositionHistory() {
  const [range, setRange] = useState<RangeValue>("24h");
  const [source, setSource] = useState<string>("alla");

  const sinceIso = useMemo(() => {
    const hours = RANGES.find((r) => r.value === range)!.hours;
    return new Date(Date.now() - hours * 3600 * 1000).toISOString();
  }, [range]);

  const pingsQ = useQuery({
    queryKey: ["location_pings", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_pings")
        .select("*")
        .gte("recorded_at", sinceIso)
        .order("recorded_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as PingRow[];
    },
  });

  const rows = pingsQ.data ?? [];
  const sources = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source))).sort(),
    [rows],
  );
  const filtered = source === "alla" ? rows : rows.filter((r) => r.source === source);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <h2 className="text-[15px] font-semibold">Positionshistorik</h2>
        {pingsQ.isFetching ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Dina senast registrerade positioner med tidsstämpel.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            aria-pressed={range === r.value}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              range === r.value
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:bg-accent"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {sources.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["alla", ...sources].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              aria-pressed={source === s}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                source === s
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {s === "alla" ? "Alla källor" : s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
        {pingsQ.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Hämtar historik…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Inga positioner i den valda perioden.
          </p>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{stamp(p.recorded_at)}</p>
                <p className="truncate text-xs tabular-nums text-muted-foreground">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  {p.accuracy_m != null ? ` · ±${Math.round(p.accuracy_m)} m` : ""} · {p.source}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${p.lat}%2C${p.lng}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Öppna positionen i Google Maps"
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          ))
        )}
      </div>

      {filtered.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Visar {filtered.length} positioner (max 300).
        </p>
      ) : null}
    </section>
  );
}

export default PositionHistory;
