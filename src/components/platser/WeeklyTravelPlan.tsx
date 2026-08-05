import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, Route, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useEvents, usePlaces, useVisits } from "@/lib/db";
import { formatDistance, formatDuration, travelModeLabel } from "@/lib/geo";
import { routeBatch } from "@/lib/maps.functions";
import { getWeeklyTravelPlanInsight } from "@/lib/travel-insight.functions";
import {
  buildTravelPlan,
  legKey,
  summarizePlan,
  type RouteLookup,
  type PreferenceRow,
  type TravelPlanItem,
} from "@/lib/travel-plan";

import { MODE_ICONS } from "./TravelModeStats";

const HISTORY_DAYS = 120;

function usePreferences() {
  return useQuery({
    queryKey: ["travel_preferences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("travel_preferences").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as PreferenceRow[];
    },
  });
}

const STATUS_STYLES: Record<TravelPlanItem["status"], string> = {
  ok: "bg-cat-ledig/12 text-cat-ledig",
  tight: "bg-cat-barn/15 text-cat-barn",
  conflict: "bg-destructive/12 text-destructive",
};

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

/** Reseplan för kommande vecka: färdsätt, avresetid och marginal per aktivitet. */
export function WeeklyTravelPlan() {
  const sinceIso = useMemo(
    () => new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString(),
    [],
  );
  const eventsQ = useEvents();
  const placesQ = usePlaces();
  const visitsQ = useVisits(sinceIso);
  const prefsQ = usePreferences();

  const basePlan = useMemo(
    () =>
      buildTravelPlan({
        events: eventsQ.data ?? [],
        places: placesQ.data ?? [],
        visits: visitsQ.data ?? [],
        preferences: prefsQ.data ?? [],
      }),
    [eventsQ.data, placesQ.data, visitsQ.data, prefsQ.data],
  );

  // Sträckor utan historik hämtas från Google Maps för verklig restid.
  const missingLegs = useMemo(
    () =>
      basePlan
        .filter((item) => item.basis !== "historik")
        .slice(0, 40)
        .map((item) => ({
          origin: item.origin,
          destination: item.destination,
          mode: item.mode === "okant" ? ("bil" as const) : item.mode,
        })),
    [basePlan],
  );

  const fetchRoutes = useServerFn(routeBatch);
  const routesQ = useQuery({
    queryKey: ["maps-route-batch", missingLegs.map((l) => legKey(l.origin, l.destination))],
    enabled: missingLegs.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const results = await fetchRoutes({ data: { legs: missingLegs } });
      const lookup: RouteLookup = {};
      missingLegs.forEach((leg, i) => {
        lookup[legKey(leg.origin, leg.destination)] = results[i] ?? null;
      });
      return lookup;
    },
  });

  const plan = useMemo(
    () =>
      routesQ.data
        ? buildTravelPlan({
            events: eventsQ.data ?? [],
            places: placesQ.data ?? [],
            visits: visitsQ.data ?? [],
            preferences: prefsQ.data ?? [],
            routes: routesQ.data,
          })
        : basePlan,
    [basePlan, routesQ.data, eventsQ.data, placesQ.data, visitsQ.data, prefsQ.data],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TravelPlanItem[]>();
    for (const item of plan) {
      const key = new Date(item.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [plan]);

  const fetchInsight = useServerFn(getWeeklyTravelPlanInsight);
  const insight = useMutation({
    mutationFn: () => fetchInsight({ data: { plan: summarizePlan(plan) } }),
    onError: (error: Error) => toast.error(error.message),
  });

  const risky = plan.filter((p) => p.status !== "ok").length;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Route className="size-4 shrink-0" /> Reseplan nästa vecka
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {plan.length
              ? `${plan.length} resor · ${risky} med knapp marginal`
              : "Inga kommande aktiviteter med känd plats"}
          </p>
        </div>
        <button
          type="button"
          disabled={!plan.length || insight.isPending}
          onClick={() => insight.mutate()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {insight.isPending ? "Andrea tänker…" : "Fråga Andrea"}
        </button>
      </div>

      {insight.data?.text ? (
        <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">
          {insight.data.text}
        </p>
      ) : null}

      {plan.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Lägg till plats på dina händelser, eller spara fler platser, så räknar appen ut
          färdsätt och avresetider automatiskt.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {grouped.map(([key, items]) => (
            <div key={key}>
              <p className="text-xs font-medium capitalize text-muted-foreground">
                {dayLabel(items[0]!.startsAt)}
              </p>
              <ul className="mt-2 space-y-2">
                {items.map((item) => {
                  const Icon = MODE_ICONS[item.mode];
                  return (
                    <li
                      key={item.eventId}
                      className="rounded-xl border border-border/70 p-3"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {timeLabel(item.startsAt)} · {item.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.fromName} → {item.toName} · {formatDistance(item.meters)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[item.status]}`}
                        >
                          {item.status === "conflict"
                            ? "Hinner inte"
                            : item.status === "tight"
                              ? "Knappt"
                              : "God tid"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Icon className="size-3.5" />
                          {travelModeLabel(item.mode)}
                          <span className="text-[10px] opacity-70">({item.modeSource})</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {formatDuration(item.minutes)} ({item.basis})
                        </span>
                        <span className="font-medium text-foreground">
                          Åk {timeLabel(item.leaveAt)}
                        </span>
                        {item.marginMinutes != null ? (
                          <span
                            className={
                              item.marginMinutes < 0 ? "text-destructive" : undefined
                            }
                          >
                            {item.marginMinutes < 0
                              ? `${Math.abs(item.marginMinutes)} min för sent`
                              : `${item.marginMinutes} min marginal`}
                          </span>
                        ) : null}
                      </div>

                      {item.status === "conflict" && item.previousTitle ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="size-3.5" />
                          Krockar med {item.previousTitle}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
