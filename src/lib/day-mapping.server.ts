import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { haversineMeters, matchPlace, type PingRow, type PlaceRow } from "@/lib/geo";
import { APP_TZ, timeLocal } from "@/lib/tz";

/**
 * Tolkar rå positionshistorik till en dagsberättelse: stopp (besök) och
 * förflyttningar (resor), med AI-förslag på namn och aktivitet för okända stopp.
 * Inget skrivs till platsloggen förrän användaren godkänner ett förslag.
 */

/** Ett stopp kräver att man håller sig inom denna radie. */
const STOP_RADIUS_M = 160;
/** Kortaste stopp som räknas (fångar hämtning, tankning, snabba ärenden). */
const MIN_STOP_MINUTES = 3;
/** Kortaste förflyttning som blir en egen resa. */
const MIN_MOVE_METERS = 400;

export type RawSegment = {
  entry_kind: "besok" | "resa";
  starts_at: string;
  ends_at: string;
  lat: number;
  lng: number;
  end_lat: number | null;
  end_lng: number | null;
  distance_m: number;
  place_id: string | null;
};

function minutes(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/** Dygnets start och slut i svensk tid, som UTC-tidsstämplar. */
export function dayRange(day: string) {
  const parts = day.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const guess = Date.UTC(y, m - 1, d, 12, 0, 0);
  // Räkna ut zonens offset för det aktuella datumet.
  const local = new Date(
    new Date(guess).toLocaleString("en-US", { timeZone: APP_TZ }),
  ).getTime();
  const offset = local - guess;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
  const end = new Date(start.getTime() + 86400000);
  return { start, end };
}

/** Delar upp pingar i stopp och förflyttningar. */
export function segmentPings(pings: PingRow[], places: PlaceRow[]): RawSegment[] {
  const clean = pings
    .filter((p) => p.accuracy_m == null || p.accuracy_m < 500)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  if (clean.length < 2) return [];

  type Cluster = { pings: PingRow[]; lat: number; lng: number };
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;

  for (const ping of clean) {
    if (current && haversineMeters(current.lat, current.lng, ping.lat, ping.lng) <= STOP_RADIUS_M) {
      current.pings.push(ping);
      const n = current.pings.length;
      current.lat += (ping.lat - current.lat) / n;
      current.lng += (ping.lng - current.lng) / n;
      continue;
    }
    if (current) clusters.push(current);
    current = { pings: [ping], lat: ping.lat, lng: ping.lng };
  }
  if (current) clusters.push(current);

  // Behåll bara kluster som varade tillräckligt länge – resten är förflyttning.
  const stops = clusters.filter((c) => {
    const first = c.pings[0]!;
    const last = c.pings[c.pings.length - 1]!;
    return minutes(first.recorded_at, last.recorded_at) >= MIN_STOP_MINUTES;
  });
  if (!stops.length) return [];

  const segments: RawSegment[] = [];
  let previous: Cluster | null = null;

  for (const stop of stops) {
    const first = stop.pings[0]!;
    const last = stop.pings[stop.pings.length - 1]!;

    if (previous) {
      const prevLast = previous.pings[previous.pings.length - 1]!;
      // Summera faktisk sträcka mellan de två stoppen.
      const between = clean.filter(
        (p) =>
          p.recorded_at > prevLast.recorded_at && p.recorded_at < first.recorded_at,
      );
      const path = [prevLast, ...between, first];
      let distance = 0;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        distance += haversineMeters(a.lat, a.lng, b.lat, b.lng);
      }

      if (distance >= MIN_MOVE_METERS) {
        segments.push({
          entry_kind: "resa",
          starts_at: prevLast.recorded_at,
          ends_at: first.recorded_at,
          lat: prevLast.lat,
          lng: prevLast.lng,
          end_lat: first.lat,
          end_lng: first.lng,
          distance_m: Math.round(distance),
          place_id: null,
        });
      }
    }

    const place = matchPlace(places, stop.lat, stop.lng);
    segments.push({
      entry_kind: "besok",
      starts_at: first.recorded_at,
      ends_at: last.recorded_at,
      lat: stop.lat,
      lng: stop.lng,
      end_lat: null,
      end_lng: null,
      distance_m: 0,
      place_id: place?.id ?? null,
    });
    previous = stop;
  }

  return segments;
}

function travelModeFor(distanceM: number, minutesSpent: number) {
  if (minutesSpent <= 0) return "okant" as const;
  const kmh = distanceM / 1000 / (minutesSpent / 60);
  if (kmh < 9) return "gang_cykel" as const;
  if (kmh < 32) return "kollektivt" as const;
  return "bil" as const;
}

type Suggestion = { index: number; label: string; activity: string; reasoning: string };

type Purchase = {
  amount: number;
  note: string | null;
  category: string | null;
  spent_at: string;
};

/** Frågar AI om namn och aktivitet för stopp som inte matchar en sparad plats. */
async function suggestLabels(
  apiKey: string,
  segments: RawSegment[],
  places: PlaceRow[],
  events: { title: string; starts_at: string; ends_at: string; location: string | null }[],
  history: { label: string | null; lat: number | null; lng: number | null }[],
  extras: Map<number, { address: string | null; seen: number; purchases: Purchase[] }>,
): Promise<Suggestion[]> {
  const unknown = segments
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.entry_kind === "besok" && !s.place_id);
  if (!unknown.length) return [];

  const { completeText } = await import("@/lib/ai-complete.server");

  const lines = unknown.map(({ s, index }) => {
    const extra = extras.get(index);
    const parts = [
      `#${index} ${timeLocal(s.starts_at)}–${timeLocal(s.ends_at)} (${Math.round(
        minutes(s.starts_at, s.ends_at),
      )} min) vid ${s.lat.toFixed(5)},${s.lng.toFixed(5)}`,
    ];
    if (extra?.address) parts.push(`adress: ${extra.address}`);
    if (extra?.seen) parts.push(`du har varit här ${extra.seen} gånger tidigare`);
    if (extra?.purchases.length)
      parts.push(
        `köp under stoppet: ${extra.purchases
          .map((p) => `${Math.round(p.amount)} kr ${p.note ?? p.category ?? ""}`.trim())
          .join("; ")}`,
      );
    return parts.join(" | ");
  });

  const input = [
    "OKÄNDA STOPP:",
    ...lines,
    "",
    "SPARADE PLATSER:",
    ...places.map((p) => `- ${p.name} (${p.kind}) ${p.lat.toFixed(5)},${p.lng.toFixed(5)}`),
    "",
    "KALENDER DENNA DAG:",
    ...(events.length
      ? events.map(
          (e) =>
            `- ${timeLocal(e.starts_at)}–${timeLocal(e.ends_at)} ${e.title}${e.location ? ` (${e.location})` : ""}`,
        )
      : ["- inga händelser"]),
    "",
    "TIDIGARE NAMNGIVNA BESÖK:",
    ...history
      .filter((h) => h.label && h.lat != null && h.lng != null)
      .slice(0, 40)
      .map((h) => `- ${h.label} ${h.lat!.toFixed(5)},${h.lng!.toFixed(5)}`),
  ].join("\n");

  const raw = await completeText({
    apiKey,
    system:
      "Du kartlägger en persons dag utifrån GPS-stopp. Föreslå ett kort platsnamn och en aktivitet " +
      "för varje okänt stopp. Använd i tur och ordning: adressen från kartan, kvitton/köp under stoppet, " +
      "koordinatnärhet till sparade platser och tidigare besök, hur ofta personen varit där, samt " +
      "kalenderns händelser. Skriv butiksnamn när ett köp matchar. Är du osäker: skriv label 'Okänd plats' " +
      "och activity ''. Motivera kort i reasoning vilken ledtråd du använde. Svara på svenska. Svara som JSON.",
    input,
    jsonSchema: {
      name: "stop_suggestions",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                index: { type: "integer" },
                label: { type: "string" },
                activity: { type: "string" },
                reasoning: { type: "string" },
              },
              required: ["index", "label", "activity", "reasoning"],
            },
          },
        },
        required: ["suggestions"],
      },
    },
  });

  try {
    const parsed = JSON.parse(raw) as { suggestions?: Suggestion[] };
    return parsed.suggestions ?? [];
  } catch {
    return [];
  }
}


/** Bygger (och sparar) dagens segment som förslag. Befintliga förslag ersätts. */
export async function analyzeDay(userId: string, day: string) {
  const { start, end } = dayRange(day);

  const [pingsRes, placesRes, eventsRes, historyRes, spendRes] = await Promise.all([
    supabaseAdmin
      .from("location_pings")
      .select("*")
      .eq("user_id", userId)
      .gte("recorded_at", start.toISOString())
      .lt("recorded_at", end.toISOString())
      .order("recorded_at"),
    supabaseAdmin.from("places").select("*").eq("user_id", userId),
    supabaseAdmin
      .from("events")
      .select("title, starts_at, ends_at, location")
      .eq("user_id", userId)
      .gte("ends_at", start.toISOString())
      .lte("starts_at", end.toISOString()),
    supabaseAdmin
      .from("visits")
      .select("label, lat, lng, arrived_at")
      .eq("user_id", userId)
      .order("arrived_at", { ascending: false })
      .limit(600),
    supabaseAdmin
      .from("spend_entries")
      .select("amount, note, category, spent_at")
      .eq("user_id", userId)
      .gte("spent_at", start.toISOString())
      .lt("spent_at", end.toISOString()),
  ]);

  const pings = pingsRes.data ?? [];
  const places = placesRes.data ?? [];
  if (pings.length < 2) {
    return { ok: false as const, message: "Det finns för få positioner för den dagen.", count: 0 };
  }

  const segments = segmentPings(pings, places);
  if (!segments.length) {
    return { ok: false as const, message: "Hittade inga tydliga stopp den dagen.", count: 0 };
  }

  const allVisits = historyRes.data ?? [];
  const purchases = (spendRes.data ?? []).map((row) => ({
    amount: Number(row.amount),
    note: row.note,
    category: row.category,
    spent_at: row.spent_at,
  }));

  /** Extra sammanhang per stopp: adress, hur ofta du varit där och köp. */
  const extras = new Map<
    number,
    { address: string | null; seen: number; purchases: Purchase[] }
  >();

  const stopIndexes = segments
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.entry_kind === "besok");

  // Adressuppslag för stoppen (begränsat antal för att hålla analysen snabb).
  const { resolvePlaceName } = await import("@/lib/maps.server");
  const geocoded = await Promise.all(
    stopIndexes
      .slice(0, 12)
      .map(async ({ s, index }) => ({
        index,
        place: await resolvePlaceName(s.lat, s.lng).catch(() => null),
      })),
  );
  const addressByIndex = new Map(
    geocoded.map((g) => [g.index, g.place ? `${g.place.shortName} – ${g.place.address}` : null]),
  );

  for (const { s, index } of stopIndexes) {
    const seen = allVisits.filter(
      (v) =>
        v.lat != null &&
        v.lng != null &&
        v.arrived_at < s.starts_at &&
        haversineMeters(v.lat, v.lng, s.lat, s.lng) <= 200,
    ).length;
    const from = new Date(s.starts_at).getTime() - 20 * 60_000;
    const to = new Date(s.ends_at).getTime() + 20 * 60_000;
    const bought = purchases.filter((p) => {
      const t = new Date(p.spent_at).getTime();
      return t >= from && t <= to;
    });
    extras.set(index, {
      address: addressByIndex.get(index) ?? null,
      seen,
      purchases: bought,
    });
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  let suggestions: Suggestion[] = [];
  if (apiKey) {
    try {
      suggestions = await suggestLabels(
        apiKey,
        segments,
        places,
        eventsRes.data ?? [],
        allVisits.filter((v) => v.label),
        extras,
      );
    } catch {
      // AI kan vara otillgänglig – segmenten är fortfarande användbara.
    }
  }
  const byIndex = new Map(suggestions.map((s) => [s.index, s]));

  // Rensa gamla, ej godkända förslag för dagen.
  await supabaseAdmin
    .from("day_segments")
    .delete()
    .eq("user_id", userId)
    .eq("day", day)
    .neq("status", "accepted");

  const rows = segments.map((s, index) => {
    const place = s.place_id ? places.find((p) => p.id === s.place_id) : null;
    const ai = byIndex.get(index);
    const extra = extras.get(index);
    const spent = minutes(s.starts_at, s.ends_at);
    const spendTotal = (extra?.purchases ?? []).reduce((sum, p) => sum + p.amount, 0);
    // Ett köp under stoppet gör namnet nästan säkert.
    const receiptName = extra?.purchases.find((p) => p.note?.trim())?.note?.trim() ?? null;
    return {
      user_id: userId,
      day,
      entry_kind: s.entry_kind,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      lat: s.lat,
      lng: s.lng,
      end_lat: s.end_lat,
      end_lng: s.end_lng,
      distance_m: s.distance_m,
      travel_mode:
        s.entry_kind === "resa" ? travelModeFor(s.distance_m, spent) : ("okant" as const),
      place_id: s.place_id,
      address: s.entry_kind === "besok" ? (extra?.address ?? null) : null,
      seen_count: extra?.seen ?? 0,
      spend_total: Math.round(spendTotal),
      suggested_label:
        s.entry_kind === "resa"
          ? "Resa"
          : (place?.name ?? receiptName ?? ai?.label ?? "Okänd plats"),
      suggested_activity: s.entry_kind === "resa" ? null : (ai?.activity ?? null),
      reasoning: ai?.reasoning ?? null,
      confidence: place ? 1 : receiptName ? 0.9 : ai ? 0.6 : 0.3,
      status: "pending",
    };
  });


  const { error } = await supabaseAdmin.from("day_segments").insert(rows);
  if (error) throw new Error(error.message);

  return {
    ok: true as const,
    message: `Kartlade ${rows.filter((r) => r.entry_kind === "besok").length} stopp och ${rows.filter((r) => r.entry_kind === "resa").length} resor.`,
    count: rows.length,
  };
}

/** Skriver ett godkänt segment till platsloggen. */
export async function acceptSegment(userId: string, segmentId: string) {
  const { data: seg, error } = await supabaseAdmin
    .from("day_segments")
    .select("*")
    .eq("id", segmentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!seg) throw new Error("Segmentet hittades inte.");
  if (seg.status === "accepted" && seg.visit_id) {
    return { ok: true as const, message: "Redan tillagt i platsloggen." };
  }

  const label = [seg.suggested_label, seg.suggested_activity].filter(Boolean).join(" – ");
  const { data: visit, error: insertError } = await supabaseAdmin
    .from("visits")
    .insert({
      user_id: userId,
      place_id: seg.place_id,
      label: label || null,
      lat: seg.lat,
      lng: seg.lng,
      end_lat: seg.end_lat,
      end_lng: seg.end_lng,
      arrived_at: seg.starts_at,
      left_at: seg.ends_at,
      entry_kind: seg.entry_kind,
      distance_m: seg.distance_m,
      travel_mode: seg.travel_mode,
      source: "ai",
      is_manual: false,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  await supabaseAdmin
    .from("day_segments")
    .update({ status: "accepted", visit_id: visit.id })
    .eq("id", segmentId);

  return { ok: true as const, message: "Tillagt i platsloggen." };
}
