import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ROUTE_FACTOR,
  guessTravelMode,
  haversineMeters,
  matchPlace,
  matchPlaceNear,
  type PingRow,
  type PlaceRow,
} from "@/lib/geo";

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

/** Kastar orimliga hopp (GPS-spikar) genom att titta på farten mellan pingar. */
function dropOutliers(pings: PingRow[]): PingRow[] {
  const out: PingRow[] = [];
  for (const ping of pings) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(ping);
      continue;
    }
    const seconds =
      (new Date(ping.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
    if (seconds <= 0) continue;
    const meters = haversineMeters(prev.lat, prev.lng, ping.lat, ping.lng);
    // Över 60 m/s (216 km/h) är det brus, inte en förflyttning.
    if (meters / seconds > 60) continue;
    out.push(ping);
  }
  return out;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Faktisk sträcka längs en rutt, med brusgolv så stillastående inte ger km. */
function pathMeters(path: PingRow[]) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const step = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    // Hopp under 30 m är oftast GPS-spridning när man står stilla.
    if (step >= 30) total += step;
  }
  return total;
}

/** Delar upp pingar i stopp och förflyttningar. */
export function segmentPings(pings: PingRow[], places: PlaceRow[]): RawSegment[] {
  const sorted = pings.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  // Använd i första hand bra fixar; finns för få faller vi tillbaka på allt.
  const accurate = sorted.filter((p) => p.accuracy_m == null || p.accuracy_m <= 120);
  const clean = dropOutliers(accurate.length >= 5 ? accurate : sorted);
  if (clean.length < 2) return [];

  type Cluster = { pings: PingRow[]; lat: number; lng: number };

  /** Mittpunkt som median – tål enstaka snedsteg bättre än ett glidande snitt. */
  const center = (cluster: Cluster) => {
    cluster.lat = median(cluster.pings.map((p) => p.lat));
    cluster.lng = median(cluster.pings.map((p) => p.lng));
  };

  const clusters: Cluster[] = [];
  let current: Cluster | null = null;

  for (const ping of clean) {
    if (current && haversineMeters(current.lat, current.lng, ping.lat, ping.lng) <= STOP_RADIUS_M) {
      current.pings.push(ping);
      center(current);
      continue;
    }
    if (current) clusters.push(current);
    current = { pings: [ping], lat: ping.lat, lng: ping.lng };
  }
  if (current) clusters.push(current);

  // Slå ihop kluster som ligger på samma ställe med bara en kort lucka emellan
  // (t.ex. när GPS:en tappar in och ut medan man står stilla).
  const merged: Cluster[] = [];
  for (const cluster of clusters) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const gapMinutes = minutes(
        prev.pings[prev.pings.length - 1]!.recorded_at,
        cluster.pings[0]!.recorded_at,
      );
      const apart = haversineMeters(prev.lat, prev.lng, cluster.lat, cluster.lng);
      if (apart <= STOP_RADIUS_M * 1.6 && gapMinutes <= 25) {
        prev.pings.push(...cluster.pings);
        center(prev);
        continue;
      }
    }
    merged.push(cluster);
  }

  // Behåll bara kluster som varade tillräckligt länge – resten är förflyttning.
  const stops = merged.filter((c) => {
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
        (p) => p.recorded_at > prevLast.recorded_at && p.recorded_at < first.recorded_at,
      );
      const path = [prevLast, ...between, first];
      const tracked = pathMeters(path);
      const straight = haversineMeters(prevLast.lat, prevLast.lng, first.lat, first.lng);
      // Har spårningen luckor blir fågelvägen (med vägfaktor) mer rättvis.
      const distance = Math.max(tracked, straight * ROUTE_FACTOR);

      if (distance >= MIN_MOVE_METERS && straight >= MIN_MOVE_METERS / 2) {
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

    const place = matchPlaceNear(places, stop.lat, stop.lng);
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
  return guessTravelMode(distanceM, minutesSpent);
}


type Suggestion = { index: number; label: string; activity: string; reasoning: string };

type Purchase = {
  amount: number;
  note: string | null;
  category: string | null;
  spent_at: string;
};

/** Allt extra sammanhang vi samlar per stopp innan AI tolkar det. */
type StopExtra = {
  address: string | null;
  seen: number;
  purchases: Purchase[];
  /** Verksamheter från Google Places inom gångavstånd. */
  nearby: { name: string; meters: number; types: string[]; ratingCount: number | null }[];
  /** Kalenderhändelser som överlappar stoppet i tid. */
  calendar: string[];
};



/** Frågar AI om namn och aktivitet för stopp som inte matchar en sparad plats. */
async function suggestLabels(
  apiKey: string,
  segments: RawSegment[],
  places: PlaceRow[],
  events: { title: string; starts_at: string; ends_at: string; location: string | null }[],
  history: { label: string | null; lat: number | null; lng: number | null }[],
  extras: Map<number, StopExtra>,
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
    if (extra?.nearby.length)
      parts.push(
        `verksamheter inom ${Math.max(...extra.nearby.map((n) => n.meters), 0)} m: ${extra.nearby
          .map(
            (n) =>
              `${n.name} (${n.meters} m${n.types[0] ? `, ${n.types[0]}` : ""}${
                n.ratingCount ? `, ${n.ratingCount} omdömen` : ""
              })`,
          )
          .join("; ")}`,
      );
    if (extra?.calendar.length)
      parts.push(`kalendern samtidigt: ${extra.calendar.join("; ")}`);
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
      "för varje okänt stopp. Prioritera ledtrådarna i denna ordning: (1) kvitton/köp under stoppet, " +
      "(2) verksamheter från Google Places inom kort avstånd – välj den som bäst matchar tid på dygnet, " +
      "stoppets längd och typ (öppettider, butik/restaurang/kontor/vård), (3) kalenderhändelser som " +
      "överlappar stoppet – stämmer tid och plats får aktiviteten komma från händelsens titel, " +
      "(4) närhet till sparade platser och tidigare namngivna besök, (5) adressen från kartan. " +
      "Är stoppet kortare än 10 minuter vid en väg utan verksamheter är det troligen en paus i en resa – " +
      "skriv label 'Kort stopp'. Långa nattliga stopp är hem, långa vardagsstopp på samma plats är jobb. " +
      "Är du osäker: skriv label 'Okänd plats' och activity ''. Motivera kort i reasoning vilken ledtråd " +
      "du använde och nämn kalendern när den bekräftar. Svara på svenska. Svara som JSON.",

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

  const [pingsRes, placesRes, eventsRes, historyRes, spendRes, receiptRes] = await Promise.all([
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
    // Butiksbesök som skapats från kvitton – används som fasta hållpunkter.
    supabaseAdmin
      .from("visits")
      .select("id, label, address, lat, lng, arrived_at, left_at, place_id, note")
      .eq("user_id", userId)
      .eq("source", "kvitto")
      .gte("arrived_at", start.toISOString())
      .lt("arrived_at", end.toISOString())
      .order("arrived_at"),
  ]);

  const pings = pingsRes.data ?? [];
  const places = placesRes.data ?? [];
  const receiptVisits = (receiptRes.data ?? []).filter((v) => v.lat != null && v.lng != null);

  const purchases = (spendRes.data ?? []).map((row) => ({
    amount: Number(row.amount),
    note: row.note,
    category: row.category,
    spent_at: row.spent_at,
  }));

  let segments = pings.length >= 2 ? segmentPings(pings, places) : [];

  // Saknas GPS-data helt kan kvittobesöken ändå bygga upp dagen.
  if (!segments.length && receiptVisits.length) {
    segments = receiptVisits.map((v) => ({
      entry_kind: "besok" as const,
      starts_at: v.arrived_at,
      ends_at: v.left_at ?? new Date(new Date(v.arrived_at).getTime() + 15 * 60_000).toISOString(),
      lat: v.lat as number,
      lng: v.lng as number,
      end_lat: null,
      end_lng: null,
      distance_m: 0,
      place_id: v.place_id,
    }));
  }

  if (!segments.length) {
    return {
      ok: false as const,
      message:
        pings.length < 2
          ? "Det finns för få positioner för den dagen."
          : "Hittade inga tydliga stopp den dagen.",
      count: 0,
    };
  }

  const allVisits = historyRes.data ?? [];


  /** Extra sammanhang per stopp: adress, verksamheter, kalender, historik och köp. */
  const extras = new Map<number, StopExtra>();

  const stopIndexes = segments
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.entry_kind === "besok");

  // Adress och verksamheter för stoppen (begränsat antal för att hålla analysen snabb).
  const { resolvePlaceName, resolveNearbyPlaces } = await import("@/lib/maps.server");
  const looked = await Promise.all(
    stopIndexes.slice(0, 12).map(async ({ s, index }) => ({
      index,
      place: await resolvePlaceName(s.lat, s.lng).catch(() => null),
      nearby: await resolveNearbyPlaces(s.lat, s.lng, 140).catch(() => []),
    })),
  );
  const infoByIndex = new Map(
    looked.map((g) => [
      g.index,
      {
        address: g.place ? `${g.place.shortName} – ${g.place.address}` : null,
        nearby: g.nearby.map((n) => ({
          name: n.name,
          meters: n.meters,
          types: n.types,
          ratingCount: n.ratingCount,
        })),
      },
    ]),
  );


  /** Kvittobesök som matchar ett stopp (närhet i tid och rum). */
  const receiptByIndex = new Map<number, (typeof receiptVisits)[number]>();
  for (const { s, index } of stopIndexes) {
    const from = new Date(s.starts_at).getTime() - 25 * 60_000;
    const to = new Date(s.ends_at).getTime() + 25 * 60_000;
    const hit = receiptVisits.find((v) => {
      const t = new Date(v.arrived_at).getTime();
      const near = haversineMeters(v.lat as number, v.lng as number, s.lat, s.lng) <= 300;
      return near || (t >= from && t <= to);
    });
    if (hit) receiptByIndex.set(index, hit);
  }

  const dayEvents = eventsRes.data ?? [];

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
    // Kalenderhändelser som överlappar stoppet (med 20 min marginal).
    const overlapping = dayEvents
      .filter((e) => {
        const eStart = new Date(e.starts_at).getTime();
        const eEnd = new Date(e.ends_at).getTime();
        return eStart <= to && eEnd >= from;
      })
      .map(
        (e) =>
          `${timeLocal(e.starts_at)}–${timeLocal(e.ends_at)} ${e.title}${
            e.location ? ` (${e.location})` : ""
          }`,
      );

    const info = infoByIndex.get(index);
    extras.set(index, {
      address: receiptByIndex.get(index)?.address ?? info?.address ?? null,
      seen,
      purchases: bought,
      nearby: info?.nearby ?? [],
      calendar: overlapping,
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
    const receipt = receiptByIndex.get(index);
    const spent = minutes(s.starts_at, s.ends_at);
    const spendTotal = (extra?.purchases ?? []).reduce((sum, p) => sum + p.amount, 0);
    // Ett köp under stoppet gör namnet nästan säkert.
    const receiptName =
      receipt?.label?.trim() || (extra?.purchases.find((p) => p.note?.trim())?.note?.trim() ?? null);
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
      suggested_activity:
        s.entry_kind === "resa" ? null : (ai?.activity ?? (receipt ? "Handlade" : null)),
      reasoning: receipt
        ? `Kvitto från ${receipt.label ?? "butik"} kopplat till stoppet.`
        : (ai?.reasoning ?? null),
      confidence: place ? 1 : receipt ? 0.95 : receiptName ? 0.9 : ai ? 0.6 : 0.3,
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
      address: seg.address,
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
