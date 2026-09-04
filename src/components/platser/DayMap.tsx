import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Car, Check, Loader2, MapPin, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { acceptDaySegment, analyzeDaySegments } from "@/lib/day-mapping.functions";
import { formatDistance, formatDuration, travelModeLabel } from "@/lib/geo";
import { dayKey, timeLocal } from "@/lib/tz";

type Segment = Tables<"day_segments">;

function minutesBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

/** AI-tolkad dagsberättelse: stopp och resor som förslag att godkänna. */
export function DayMap() {
  const qc = useQueryClient();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const analyze = useServerFn(analyzeDaySegments);
  const accept = useServerFn(acceptDaySegment);

  const segmentsQ = useQuery({
    queryKey: ["day_segments", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_segments")
        .select("*")
        .eq("day", day)
        .order("starts_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Segment[];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["day_segments", day] });
    qc.invalidateQueries({ queryKey: ["visits"] });
  }

  const analyzeMutation = useMutation({
    mutationFn: () => analyze({ data: { day } }),
    onSuccess: (result) => {
      invalidate();
      if (result.ok) toast.success(result.message);
      else toast.info(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => accept({ data: { id } }),
    onSuccess: (result) => {
      invalidate();
      toast.success(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ignoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("day_segments")
        .update({ status: "ignored" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("day_segments")
        .update({ suggested_label: value, confidence: 1 })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Kör kartläggningen automatiskt när dagen är oanalyserad – slipper knapptryck.
  const autoRan = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!segmentsQ.isSuccess || segmentsQ.data.length > 0) return;
    if (autoRan.current[day] || analyzeMutation.isPending) return;
    autoRan.current[day] = true;
    analyzeMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, segmentsQ.isSuccess, segmentsQ.data]);

  const segments = (segmentsQ.data ?? []).filter((s) => s.status !== "ignored");

  const totalKm = segments.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const totalMinutes = segments
    .filter((s) => s.entry_kind === "besok")
    .reduce((sum, s) => sum + minutesBetween(s.starts_at, s.ends_at), 0);

  return (
    <section className="rounded-[18px] border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" /> Min dag enligt AI
          </h2>
          <p className="text-xs text-muted-foreground">
            Positionshistoriken tolkas till stopp och resor. Du godkänner vad som sparas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={day}
            className="h-9 w-[150px]"
            onChange={(e) => setDay(e.target.value)}
          />
          <Button
            size="sm"
            disabled={analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate()}
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Analysera dagen
          </Button>
        </div>
      </div>

      {segmentsQ.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Hämtar dagen…</p>
      ) : segments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Ingen kartläggning ännu för den här dagen. Tryck på Analysera dagen.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            {segments.filter((s) => s.entry_kind === "besok").length} stopp ·{" "}
            {segments.filter((s) => s.entry_kind === "resa").length} resor ·{" "}
            {formatDistance(totalKm)} · {formatDuration(totalMinutes)} på plats
          </p>

          <ol className="mt-3 space-y-2">
            {segments.map((s) => {
              const isTrip = s.entry_kind === "resa";
              const mins = minutesBetween(s.starts_at, s.ends_at);
              const accepted = s.status === "accepted";
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 rounded-2xl border bg-background/60 p-3"
                >
                  <span
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                      isTrip ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
                    }`}
                  >
                    {isTrip ? <Car className="size-4" /> : <MapPin className="size-4" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    {editing?.id === s.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={editing.value}
                          className="h-8"
                          onChange={(e) => setEditing({ id: s.id, value: e.target.value })}
                        />
                        <Button
                          size="sm"
                          disabled={!editing.value.trim()}
                          onClick={() =>
                            renameMutation.mutate({ id: s.id, value: editing.value.trim() })
                          }
                        >
                          Spara
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="truncate text-left text-sm font-medium hover:underline"
                        onClick={() =>
                          setEditing({ id: s.id, value: s.suggested_label ?? "" })
                        }
                      >
                        {s.suggested_label ?? "Okänd plats"}
                        {s.suggested_activity ? (
                          <span className="text-muted-foreground"> – {s.suggested_activity}</span>
                        ) : null}
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {timeLocal(s.starts_at)}–{timeLocal(s.ends_at)} · {formatDuration(mins)}
                      {isTrip
                        ? ` · ${formatDistance(s.distance_m)} · ${travelModeLabel(s.travel_mode)}`
                        : ""}
                      {accepted ? " · sparad" : ""}
                    </p>
                    {!isTrip && s.address ? (
                      <p className="truncate text-[11px] text-muted-foreground/80">{s.address}</p>
                    ) : null}
                    {!isTrip && ((s.seen_count ?? 0) > 0 || Number(s.spend_total ?? 0) > 0) ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(s.seen_count ?? 0) > 0 ? (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium">
                            {s.seen_count} tidigare besök
                          </span>
                        ) : null}
                        {Number(s.spend_total ?? 0) > 0 ? (
                          <span className="rounded-full bg-nav-handla/15 px-2 py-0.5 text-[10px] font-medium text-nav-handla">
                            {Math.round(Number(s.spend_total))} kr spenderat
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {s.reasoning && !accepted ? (
                      <p className="mt-1 text-[11px] text-muted-foreground/80">{s.reasoning}</p>
                    ) : null}

                  </div>

                  {accepted ? null : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Godkänn"
                        disabled={acceptMutation.isPending}
                        onClick={() => acceptMutation.mutate(s.id)}
                      >
                        <Check className="size-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Ignorera"
                        onClick={() => ignoreMutation.mutate(s.id)}
                      >
                        <X className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
