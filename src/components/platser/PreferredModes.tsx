import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Target } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useVisits } from "@/lib/db";
import { isTravel, TRAVEL_MODES, type PlaceRow, type TravelMode, type VisitRow } from "@/lib/geo";
import { endpointKey, WEEKDAYS, weekdayIndex } from "@/lib/route-key";

const DAYS = 90;

type PrefRow = {
  id: string;
  kind: string;
  route_key: string | null;
  weekday: number | null;
  preferred_mode: TravelMode;
};

function usePreferences() {
  return useQuery({
    queryKey: ["travel_preferences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("travel_preferences").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as PrefRow[];
    },
  });
}

function useSavePreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: "rutt" | "veckodag";
      routeKey: string | null;
      weekday: number | null;
      mode: TravelMode | null;
    }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Du är inte inloggad.");

      let del = supabase
        .from("travel_preferences")
        .delete()
        .eq("user_id", userData.user.id)
        .eq("kind", input.kind);
      del = input.routeKey ? del.eq("route_key", input.routeKey) : del.is("route_key", null);
      del = input.weekday != null ? del.eq("weekday", input.weekday) : del.is("weekday", null);
      const { error: delError } = await del;
      if (delError) throw new Error(delError.message);

      if (!input.mode) return;
      const { error } = await supabase.from("travel_preferences").insert({
        user_id: userData.user.id,
        kind: input.kind,
        route_key: input.routeKey,
        weekday: input.weekday,
        preferred_mode: input.mode,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel_preferences"] });
      toast.success("Preferens sparad");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

type Group = {
  id: string;
  label: React.ReactNode;
  trips: VisitRow[];
};

function adherence(trips: VisitRow[], mode: TravelMode | null) {
  if (!mode || trips.length === 0) return null;
  const hits = trips.filter((t) => (t.travel_mode ?? "okant") === mode).length;
  return { hits, total: trips.length, pct: Math.round((hits / trips.length) * 100) };
}

function ModeRow({
  group,
  pref,
  onChange,
  saving,
}: {
  group: Group;
  pref: TravelMode | null;
  onChange: (mode: TravelMode | null) => void;
  saving: boolean;
}) {
  const stat = adherence(group.trips, pref);
  return (
    <li className="rounded-xl border border-border/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">{group.label}</span>
        <select
          value={pref ?? ""}
          disabled={saving}
          onChange={(e) => onChange((e.target.value || null) as TravelMode | null)}
          className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs"
        >
          <option value="">Inget valt</option>
          {TRAVEL_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              stat == null
                ? "bg-transparent"
                : stat.pct >= 70
                  ? "bg-emerald-500"
                  : stat.pct >= 40
                    ? "bg-amber-500"
                    : "bg-red-500"
            }`}
            style={{ width: `${stat?.pct ?? 0}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {stat
            ? `${stat.pct}% (${stat.hits}/${stat.total} resor)`
            : `${group.trips.length} resor`}
        </span>
      </div>
    </li>
  );
}

/** Prefererat färdsätt per resväg och veckodag, med hur ofta det följs. */
export function PreferredModes({ places }: { places: PlaceRow[] }) {
  const sinceIso = useMemo(() => new Date(Date.now() - DAYS * 86400000).toISOString(), []);
  const visitsQ = useVisits(sinceIso);
  const prefsQ = usePreferences();
  const save = useSavePreference();

  const { routes, weekdays } = useMemo(() => {
    const trips = (visitsQ.data ?? []).filter(isTravel);
    const routeMap = new Map<string, { from: string; to: string; trips: VisitRow[] }>();
    const dayMap = new Map<number, VisitRow[]>();

    for (const visit of trips) {
      const day = weekdayIndex(new Date(visit.arrived_at));
      dayMap.set(day, [...(dayMap.get(day) ?? []), visit]);

      const start = visit.lat != null && visit.lng != null ? { lat: visit.lat, lng: visit.lng } : null;
      const end =
        visit.end_lat != null && visit.end_lng != null
          ? { lat: visit.end_lat, lng: visit.end_lng }
          : null;
      if (!start || !end) continue;
      const from = endpointKey(start, places, "Okänd start");
      const to = endpointKey(end, places, "Okänt mål");
      const key = `${from}→${to}`;
      const entry = routeMap.get(key) ?? { from, to, trips: [] };
      entry.trips.push(visit);
      routeMap.set(key, entry);
    }

    return {
      routes: [...routeMap.entries()]
        .filter(([, e]) => e.trips.length >= 2)
        .sort((a, b) => b[1].trips.length - a[1].trips.length)
        .slice(0, 6),
      weekdays: [...dayMap.entries()].sort((a, b) => a[0] - b[0]),
    };
  }, [visitsQ.data, places]);

  const prefFor = (kind: "rutt" | "veckodag", routeKey: string | null, weekday: number | null) =>
    prefsQ.data?.find(
      (p) => p.kind === kind && p.route_key === routeKey && p.weekday === weekday,
    )?.preferred_mode ?? null;

  const empty = routes.length === 0 && weekdays.length === 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4" /> Prefererat färdsätt
        </h2>
        <span className="text-xs text-muted-foreground">Senaste {DAYS} dagarna</span>
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Inga resor att sätta preferens på ännu.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {routes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Per resväg</p>
              <ul className="space-y-1.5">
                {routes.map(([key, entry]) => (
                  <ModeRow
                    key={key}
                    saving={save.isPending}
                    group={{
                      id: key,
                      trips: entry.trips,
                      label: (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{entry.from}</span>
                          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{entry.to}</span>
                        </span>
                      ),
                    }}
                    pref={prefFor("rutt", key, null)}
                    onChange={(mode) =>
                      save.mutate({ kind: "rutt", routeKey: key, weekday: null, mode })
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          {weekdays.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" /> Per veckodag
              </p>
              <ul className="space-y-1.5">
                {weekdays.map(([day, trips]) => (
                  <ModeRow
                    key={day}
                    saving={save.isPending}
                    group={{ id: String(day), trips, label: WEEKDAYS[day] }}
                    pref={prefFor("veckodag", null, day)}
                    onChange={(mode) =>
                      save.mutate({ kind: "veckodag", routeKey: null, weekday: day, mode })
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
