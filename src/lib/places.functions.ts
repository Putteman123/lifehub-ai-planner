import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildInlineLink } from "@/lib/owntracks-config";

const positionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(100000).nullable().optional(),
  source: z.enum(["app", "live", "manual"]).optional(),
});

/** Registrerar min nuvarande position och uppdaterar besöksloggen. */
export const recordMyPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => positionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { recordPosition } = await import("@/lib/visit-tracking.server");
    const result = await recordPosition(context.userId, {
      lat: data.lat,
      lng: data.lng,
      accuracy_m: data.accuracy_m ?? null,
      source: data.source ?? "app",
    });
    return result;
  });

/** Stänger pågående besök ("Jag går nu"). */
export const endMyVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { closeOpenVisit } = await import("@/lib/visit-tracking.server");
    const closed = await closeOpenVisit(context.userId);
    return { closed };
  });

/**
 * Städar loggen och svarar på "funkar det?": senaste position, källa och om
 * något besök pågår just nu.
 */
export const placesStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { closeStaleVisits } = await import("@/lib/visit-tracking.server");
    const cleaned = await closeStaleVisits(context.userId);

    const supabase = context.supabase;
    const { data: ping } = await supabase
      .from("location_pings")
      .select("recorded_at, source")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: phonePing } = await supabase
      .from("location_pings")
      .select("recorded_at")
      .eq("source", "telefon")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: open } = await supabase
      .from("visits")
      .select("id, label, arrived_at, entry_kind, place_id")
      .is("left_at", null)
      .order("arrived_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: phoneToday } = await supabase
      .from("location_pings")
      .select("id", { count: "exact", head: true })
      .eq("source", "telefon")
      .gte("recorded_at", since);

    return {
      lastPingAt: ping?.recorded_at ?? null,
      lastPingSource: ping?.source ?? null,
      lastPhonePingAt: phonePing?.recorded_at ?? null,
      phonePings24h: phoneToday ?? 0,
      openVisit: open
        ? {
            id: open.id,
            label: open.label,
            arrivedAt: open.arrived_at,
            isTravel: open.entry_kind === "resa",
            placeId: open.place_id,
          }
        : null,
      cleaned,
    };
  });

/** Publik adress som telefonen alltid når – aldrig förhandsvisningen. */
const PUBLIC_ORIGIN = "https://lifehub-ai-planner.lovable.app";

/** Väljer den adress telefonen alltid når – aldrig förhandsvisningen. */
async function stableOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const origin = new URL(getRequest().url).origin;
  return /-preview--|localhost|127\.0\.0\.1/.test(origin) ? PUBLIC_ORIGIN : origin;
}

type LocatorMode = "move" | "significant";

function buildLinks(origin: string, token: string, mode: LocatorMode) {
  const t = encodeURIComponent(token);
  const otrcUrl = `${origin}/api/public/otrc?token=${t}&mode=${mode}`;
  const ingestUrl = `${origin}/api/public/plats?token=${t}`;
  return {
    url: ingestUrl,
    otrcUrl,
    owntracksLink: buildInlineLink(ingestUrl, mode),
    locatorMode: mode,
  };
}

/** Läser (eller skapar) appens egna platsinställningar. */
async function readSettings(supabase: {
  from: (t: "location_settings") => any;
}): Promise<{ token: string; mode: LocatorMode }> {
  const { data } = await supabase
    .from("location_settings")
    .select("token, locator_mode")
    .limit(1)
    .maybeSingle();
  if (data?.token) {
    return {
      token: data.token as string,
      mode: (data.locator_mode as LocatorMode) ?? "move",
    };
  }
  const fallback = process.env["LOCATION_INGEST_TOKEN_V2"] ?? "";
  return { token: fallback, mode: "move" };
}

/** Ger den privata webhook-adressen och den färdiga OwnTracks-länken. */
export const getIngestInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { token, mode } = await readSettings(context.supabase as never);
    const origin = await stableOrigin();
    return { ...buildLinks(origin, token, mode), configured: Boolean(token) };
  });

/** Skapar en ny hemlig nyckel och returnerar de nya länkarna. */
export const rotateIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { mode } = await readSettings(context.supabase as never);
    await (context.supabase as never as { from: (t: string) => any })
      .from("location_settings")
      .upsert({ id: true, token, locator_mode: mode }, { onConflict: "id" });
    const origin = await stableOrigin();
    return { ...buildLinks(origin, token, mode), configured: true };
  });

/** Sparar valt rapporteringsläge (Move eller Significant). */
export const setLocatorMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mode: z.enum(["move", "significant"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { token } = await readSettings(context.supabase as never);
    await (context.supabase as never as { from: (t: string) => any })
      .from("location_settings")
      .upsert({ id: true, token, locator_mode: data.mode }, { onConflict: "id" });
    const origin = await stableOrigin();
    return { ...buildLinks(origin, token, data.mode), configured: Boolean(token) };
  });


/** Visar om telefonen överhuvudtaget når fram, och vad som i så fall händer. */
export const ingestDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("location_ingest_log")
      .select("received_at, outcome, detail, had_token, user_agent")
      .order("received_at", { ascending: false })
      .limit(20);

    const list = rows ?? [];
    const last = list[0] ?? null;
    const lastOk = list.find((r) => r.outcome === "ok") ?? null;
    const lastTest = list.find((r) => r.outcome === "test_ok") ?? null;

    // Krypterade OwnTracks-meddelanden kan vi inte läsa – positionerna går förlorade.
    const lastEncrypted =
      list.find(
        (r) => r.outcome === "annan_typ" && (r.detail ?? "").includes("encrypted"),
      ) ?? null;
    const encryptedAfterOk = Boolean(
      lastEncrypted && (!lastOk || lastEncrypted.received_at > lastOk.received_at),
    );

    let verdict: "ingen_kontakt" | "fel_nyckel" | "fel_format" | "ok" = "ingen_kontakt";
    if (lastOk) verdict = "ok";
    else if (list.some((r) => r.outcome === "fel_nyckel" || r.outcome === "ingen_nyckel"))
      verdict = "fel_nyckel";
    else if (list.some((r) => r.outcome === "ogiltig_json" || r.outcome === "annan_typ"))
      verdict = "fel_format";

    return {
      verdict,
      encrypted: encryptedAfterOk,
      lastEncryptedAt: lastEncrypted?.received_at ?? null,
      lastAt: last?.received_at ?? null,
      lastOutcome: last?.outcome ?? null,
      lastOkAt: lastOk?.received_at ?? null,
      lastTestAt: lastTest?.received_at ?? null,
      recent: list.slice(0, 8).map((r) => ({
        at: r.received_at,
        outcome: r.outcome,
        detail: r.detail,
      })),
    };
  });

/** Skickar ett testanrop till mottagningen och rapporterar hela kedjan. */
export const testIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { token } = await readSettings(context.supabase as never);
    if (!token) return { ok: false, status: 0, message: "Nyckeln saknas på servern." };
    const stable = await stableOrigin();
    try {
      const res = await fetch(`${stable}/api/public/plats?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          _type: "location",
          _lifehub_test: true,
          lat: 0,
          lon: 0,
          acc: 1,
          tst: Math.floor(Date.now() / 1000),
        }),
      });
      return {
        ok: res.ok,
        status: res.status,
        message: res.ok
          ? "Mottagningen godkände adressen och OwnTracks-formatet. Skicka nu en position från telefonen."
          : `Adressen svarade med fel (${res.status}).`,
      };
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : "Okänt fel" };
    }
  });


/** Raderar all platshistorik (positioner och besök). */
export const clearLocationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("visits").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("location_pings").delete().eq("user_id", context.userId);
    return { ok: true };
  });

const nameVisitSchema = z.object({
  visitId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  note: z.string().trim().max(120).optional().default(""),
  kind: z.enum(["jobb", "jurist", "hem", "barn", "annat"]),
  saveAsPlace: z.boolean().optional().default(false),
});

/** Namnger ett okänt besök och kan spara det som en fast plats. */
export const nameVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => nameVisitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { PLACE_KINDS, haversineMeters } = await import("@/lib/geo");
    const supabase = context.supabase;

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("*")
      .eq("id", data.visitId)
      .maybeSingle();
    if (visitError) throw new Error(visitError.message);
    if (!visit) throw new Error("Besöket hittades inte.");

    const note = data.note || null;
    let placeId: string | null = visit.place_id;
    let linked = 0;

    if (data.saveAsPlace && visit.lat != null && visit.lng != null) {
      const radius = 150;
      const color = PLACE_KINDS.find((k) => k.value === data.kind)?.color ?? "#64748b";
      const { data: place, error: placeError } = await supabase
        .from("places")
        .insert({
          user_id: context.userId,
          name: data.label,
          kind: data.kind,
          lat: visit.lat,
          lng: visit.lng,
          radius_m: radius,
          color,
        })
        .select("id")
        .single();
      if (placeError) throw new Error(placeError.message);
      placeId = place.id;

      const { data: orphans, error: orphanError } = await supabase
        .from("visits")
        .select("id, lat, lng")
        .is("place_id", null);
      if (orphanError) throw new Error(orphanError.message);

      const nearby = (orphans ?? []).filter(
        (v) =>
          v.lat != null &&
          v.lng != null &&
          haversineMeters(v.lat, v.lng, visit.lat!, visit.lng!) <= radius,
      );
      if (nearby.length > 0) {
        const { error: linkError } = await supabase
          .from("visits")
          .update({ place_id: placeId, label: data.label })
          .in(
            "id",
            nearby.map((v) => v.id),
          );
        if (linkError) throw new Error(linkError.message);
        linked = nearby.length;
      }
    }

    const { error: updateError } = await supabase
      .from("visits")
      .update({ label: data.label, note, place_id: placeId })
      .eq("id", data.visitId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true, placeId, linked };
  });

const markTravelSchema = z.object({ visitId: z.string().uuid() });

/** Markerar ett besök som resa – appen fyller i start, slut, sträcka och färdsätt. */
export const markVisitTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => markTravelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { markVisitAsTravel } = await import("@/lib/travel-classify.server");
    return markVisitAsTravel(context.supabase, context.userId, data.visitId);
  });

const undoTravelSchema = z.object({
  visitId: z.string().uuid(),
  previous: z.object({
    entry_kind: z.enum(["besok", "resa"]),
    distance_m: z.number(),
    travel_mode: z.enum(["bil", "kollektivt", "gang_cykel", "okant"]),
    distance_verified: z.boolean(),
    label: z.string().nullable(),
    place_id: z.string().nullable(),
  }),
});

/** Ångrar en resemarkering. */
export const undoVisitTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => undoTravelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { undoTravel } = await import("@/lib/travel-classify.server");
    return undoTravel(context.supabase, context.userId, data.visitId, data.previous);
  });

const mergeSchema = z.object({ visitIds: z.array(z.string().uuid()).min(2).max(20) });

/** Slår ihop flera resor i följd till en. */
export const mergeVisitTravels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mergeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { mergeTravelVisits } = await import("@/lib/travel-classify.server");
    return mergeTravelVisits(context.supabase, context.userId, data.visitIds);
  });

const snapshotRowSchema = z.object({
  id: z.string().uuid(),
  place_id: z.string().uuid().nullable(),
  label: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  end_lat: z.number().nullable(),
  end_lng: z.number().nullable(),
  arrived_at: z.string(),
  left_at: z.string().nullable(),
  source: z.string(),
  is_manual: z.boolean(),
  note: z.string().nullable(),
  entry_kind: z.enum(["besok", "resa"]),
  distance_m: z.number(),
  distance_verified: z.boolean(),
  travel_mode: z.enum(["bil", "kollektivt", "gang_cykel", "okant"]),
});

const undoMergeSchema = z.object({ snapshot: z.array(snapshotRowSchema).min(2).max(20) });

/** Ångrar en sammanslagning och återställer originalresorna. */
export const undoVisitTravelMerge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => undoMergeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { undoMergeTravelVisits } = await import("@/lib/travel-classify.server");
    return undoMergeTravelVisits(context.supabase, context.userId, data.snapshot);
  });

const mergeVisitsSchema = z.object({ visitIds: z.array(z.string().uuid()).min(2).max(30) });

/** Slår ihop flera besök till ett sammanhängande – behåller det tidigaste. */
export const mergeVisits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mergeVisitsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: rows, error } = await supabase
      .from("visits")
      .select("*")
      .in("id", data.visitIds)
      .eq("user_id", context.userId)
      .order("arrived_at");
    if (error) throw new Error(error.message);
    if (!rows || rows.length < 2) throw new Error("Hittade inte besöken att slå ihop.");

    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    const meters = rows.reduce((sum, r) => sum + (r.distance_m ?? 0), 0);
    const note =
      rows
        .map((r) => r.note?.trim())
        .filter(Boolean)
        .join(" · ") || null;

    const { error: updateError } = await supabase
      .from("visits")
      .update({
        left_at: last.left_at,
        end_lat: last.end_lat ?? last.lat,
        end_lng: last.end_lng ?? last.lng,
        distance_m: meters,
        note,
        label: first.label ?? last.label,
      })
      .eq("id", first.id);
    if (updateError) throw new Error(updateError.message);

    const removeIds = rows.slice(1).map((r) => r.id);
    const { error: deleteError } = await supabase.from("visits").delete().in("id", removeIds);
    if (deleteError) throw new Error(deleteError.message);

    return { id: first.id, removed: removeIds.length };
  });
