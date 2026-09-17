import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrg, type Ctx } from "@/lib/care-admin.functions";

const slugInput = z.object({ slug: z.string().min(1).max(60) });

export type CareStop = {
  visitId: string;
  clientId: string;
  clientName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  checkin_at: string | null;
  checkout_at: string | null;
  travel_meters: number | null;
  travel_seconds: number | null;
};

function dayRange(date: string) {
  const from = new Date(`${date}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Fågelvägen i meter – används för snabba uppskattningar utan Google-anrop. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* ---------------- Koordinater ---------------- */

/** Hämtar koordinater för brukare som har adress men saknar position. */
export const geocodeClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: rows } = await context.supabase
      .from("care_clients")
      .select("id, name, address, lat, lng")
      .eq("org_id", org.id)
      .not("address", "is", null)
      .is("lat", null)
      .limit(15);

    const pending = (rows ?? []) as Array<{ id: string; address: string | null }>;
    if (pending.length === 0) return { updated: 0, failed: 0 };

    const { geocodeAddress } = await import("./google.server");
    let updated = 0;
    let failed = 0;
    for (const row of pending) {
      const point = await geocodeAddress(row.address ?? "");
      if (!point) {
        failed += 1;
        continue;
      }
      const { error } = await context.supabase
        .from("care_clients")
        .update({ lat: point.lat, lng: point.lng })
        .eq("id", row.id)
        .eq("org_id", org.id);
      if (error) failed += 1;
      else updated += 1;
    }
    return { updated, failed };
  });

/** Sätter en brukares position manuellt. */
export const setClientPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        clientId: z.string().uuid(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase
      .from("care_clients")
      .update({ lat: data.lat, lng: data.lng })
      .eq("id", data.clientId)
      .eq("org_id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Karta och dagsrutt ---------------- */

/** Brukare med position plus dagens besök – underlag för kartan. */
export const getCareMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), date: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { from, to } = dayRange(data.date);

    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name, address, lat, lng, is_active")
      .eq("org_id", org.id)
      .order("name");
    const { data: visits } = await context.supabase
      .from("care_visits")
      .select(
        "id, title, starts_at, ends_at, status, client_id, staff_id, checkin_at, checkout_at, travel_meters, travel_seconds",
      )
      .eq("org_id", org.id)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    const { data: staff } = await context.supabase
      .from("org_members")
      .select("id, display_name")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .order("display_name");

    const missing = (clients ?? []).filter(
      (c: { address: string | null; lat: number | null }) => c.address && c.lat == null,
    ).length;

    return {
      org,
      clients: clients ?? [],
      visits: visits ?? [],
      staff: staff ?? [],
      missingPositions: missing,
    };
  });

/** Dagens rutt för en medarbetare med verklig körsträcka mellan stoppen. */
export const getDayRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ slug: z.string(), date: z.string().min(8), staffId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { from, to } = dayRange(data.date);

    const { data: visits } = await context.supabase
      .from("care_visits")
      .select(
        "id, title, starts_at, ends_at, status, client_id, checkin_at, checkout_at, travel_meters, travel_seconds",
      )
      .eq("org_id", org.id)
      .eq("staff_id", data.staffId)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");

    const rows = (visits ?? []) as Array<Record<string, any>>;
    if (rows.length === 0) return { stops: [] as CareStop[], legs: [], totals: null };

    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name, address, lat, lng")
      .eq("org_id", org.id);
    const byId = new Map(
      ((clients ?? []) as Array<{ id: string }>).map((c) => [c.id, c as any]),
    );

    const stops: CareStop[] = rows.map((v) => {
      const c = byId.get(v['client_id'] as string);
      return {
        visitId: v['id'],
        clientId: v['client_id'],
        clientName: c?.name ?? "Okänd brukare",
        address: c?.address ?? null,
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
        title: v['title'] ?? null,
        starts_at: v['starts_at'],
        ends_at: v['ends_at'],
        status: v['status'],
        checkin_at: v['checkin_at'] ?? null,
        checkout_at: v['checkout_at'] ?? null,
        travel_meters: v['travel_meters'] ?? null,
        travel_seconds: v['travel_seconds'] ?? null,
      };
    });

    // Sträckor mellan stopp med känd position.
    const legInputs: Array<{
      index: number;
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
    }> = [];
    for (let i = 1; i < stops.length; i += 1) {
      const a = stops[i - 1]!;
      const b = stops[i]!;
      if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue;
      legInputs.push({
        index: i,
        origin: { lat: a.lat, lng: a.lng },
        destination: { lat: b.lat, lng: b.lng },
      });
    }

    const { resolveLegs } = await import("./maps.server");
    const resolved = await resolveLegs(
      legInputs.slice(0, 20).map((l) => ({ origin: l.origin, destination: l.destination, mode: "bil" as const })),
    );

    const legs: Array<{
      fromName: string;
      toName: string;
      meters: number;
      minutes: number;
      polyline: string | null;
      gapMinutes: number;
      tight: boolean;
    }> = [];

    for (let i = 0; i < legInputs.length && i < resolved.length; i += 1) {
      const leg = legInputs[i]!;
      const res = resolved[i];
      const a = stops[leg.index - 1]!;
      const b = stops[leg.index]!;
      const meters = res?.meters ?? haversine(leg.origin, leg.destination);
      const minutes = res?.minutes ?? Math.round(meters / 500);
      b.travel_meters = meters;
      b.travel_seconds = minutes * 60;
      await context.supabase
        .from("care_visits")
        .update({ travel_meters: meters, travel_seconds: minutes * 60 })
        .eq("id", b.visitId)
        .eq("org_id", org.id);
      const gapMinutes = Math.round(
        (new Date(b.starts_at).getTime() - new Date(a.ends_at).getTime()) / 60000,
      );
      legs.push({
        fromName: a.clientName,
        toName: b.clientName,
        meters,
        minutes,
        polyline: res?.polyline ?? null,
        gapMinutes,
        tight: gapMinutes < minutes,
      });
    }

    const totals = {
      stops: stops.length,
      meters: legs.reduce((s, l) => s + l.meters, 0),
      travelMinutes: legs.reduce((s, l) => s + l.minutes, 0),
      tight: legs.filter((l) => l.tight).length,
    };

    return { stops, legs, totals };
  });

/* ---------------- In- och utcheckning ---------------- */

export const checkInVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), visitId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase
      .from("care_visits")
      .update({ checkin_at: new Date().toISOString(), status: "pagar" })
      .eq("id", data.visitId)
      .eq("org_id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkOutVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        visitId: z.string().uuid(),
        deviation: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase
      .from("care_visits")
      .update({
        checkout_at: new Date().toISOString(),
        status: "utfort",
        deviation: data.deviation?.trim() ? data.deviation.trim() : null,
      })
      .eq("id", data.visitId)
      .eq("org_id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setVisitStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        visitId: z.string().uuid(),
        status: z.enum(["planerad", "pagar", "utfort", "uteblivet"]),
        deviation: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const patch: {
      status: string;
      deviation?: string | null;
      checkin_at?: string | null;
      checkout_at?: string | null;
    } = { status: data.status };
    if (data.deviation !== undefined) patch.deviation = data.deviation.trim() || null;
    if (data.status === "planerad") {
      patch.checkin_at = null;
      patch.checkout_at = null;
    }
    const { error } = await context.supabase
      .from("care_visits")
      .update(patch)
      .eq("id", data.visitId)
      .eq("org_id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Rapporter ---------------- */

export type ReportRow = {
  id: string;
  name: string;
  visits: number;
  done: number;
  missed: number;
  plannedMinutes: number;
  actualMinutes: number;
  meters: number;
  travelMinutes: number;
  lateStarts: number;
};

function emptyRow(id: string, name: string): ReportRow {
  return {
    id,
    name,
    visits: 0,
    done: 0,
    missed: 0,
    plannedMinutes: 0,
    actualMinutes: 0,
    meters: 0,
    travelMinutes: 0,
    lateStarts: 0,
  };
}

/** Antal besök, timmar, kilometer och punktlighet för en period. */
export const getCareReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        from: z.string().min(8),
        to: z.string().min(8),
        staffId: z.string().uuid().nullable().optional(),
        clientId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const fromIso = new Date(`${data.from}T00:00:00`).toISOString();
    const toDate = new Date(`${data.to}T00:00:00`);
    toDate.setDate(toDate.getDate() + 1);

    let query = context.supabase
      .from("care_visits")
      .select(
        "id, starts_at, ends_at, status, client_id, staff_id, checkin_at, checkout_at, travel_meters, travel_seconds, deviation",
      )
      .eq("org_id", org.id)
      .gte("starts_at", fromIso)
      .lt("starts_at", toDate.toISOString())
      .order("starts_at");
    if (data.staffId) query = query.eq("staff_id", data.staffId);
    if (data.clientId) query = query.eq("client_id", data.clientId);

    const { data: visitRows, error } = await query;
    if (error) throw new Error(error.message);
    const visits = (visitRows ?? []) as Array<Record<string, any>>;

    const { data: staffRows } = await context.supabase
      .from("org_members")
      .select("id, display_name")
      .eq("org_id", org.id);
    const { data: clientRows } = await context.supabase
      .from("care_clients")
      .select("id, name")
      .eq("org_id", org.id);

    const staffName = new Map(
      ((staffRows ?? []) as Array<{ id: string; display_name: string | null }>).map((s) => [
        s.id,
        s.display_name ?? "Namnlös",
      ]),
    );
    const clientName = new Map(
      ((clientRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
    );

    const byStaff = new Map<string, ReportRow>();
    const byClient = new Map<string, ReportRow>();
    const byDay = new Map<string, { day: string; visits: number; minutes: number; meters: number }>();

    const totals = emptyRow("total", "Totalt");
    let deviations = 0;

    for (const v of visits) {
      const planned = Math.max(
        0,
        Math.round(
          (new Date(v['ends_at']).getTime() - new Date(v['starts_at']).getTime()) / 60000,
        ),
      );
      const actual =
        v['checkin_at'] && v['checkout_at']
          ? Math.max(
              0,
              Math.round(
                (new Date(v['checkout_at']).getTime() - new Date(v['checkin_at']).getTime()) /
                  60000,
              ),
            )
          : 0;
      const meters = v['travel_meters'] ?? 0;
      const travelMinutes = Math.round((v['travel_seconds'] ?? 0) / 60);
      const late =
        v['checkin_at'] &&
        new Date(v['checkin_at']).getTime() - new Date(v['starts_at']).getTime() > 10 * 60000
          ? 1
          : 0;
      if (v['deviation']) deviations += 1;

      const apply = (row: ReportRow) => {
        row.visits += 1;
        if (v['status'] === "utfort") row.done += 1;
        if (v['status'] === "uteblivet") row.missed += 1;
        row.plannedMinutes += planned;
        row.actualMinutes += actual;
        row.meters += meters;
        row.travelMinutes += travelMinutes;
        row.lateStarts += late;
      };

      apply(totals);

      const sid = (v['staff_id'] as string | null) ?? "__none__";
      if (!byStaff.has(sid)) {
        byStaff.set(sid, emptyRow(sid, sid === "__none__" ? "Obemannat" : (staffName.get(sid) ?? "Okänd")));
      }
      apply(byStaff.get(sid)!);

      const cid = v['client_id'] as string;
      if (!byClient.has(cid)) byClient.set(cid, emptyRow(cid, clientName.get(cid) ?? "Okänd"));
      apply(byClient.get(cid)!);

      const day = String(v['starts_at']).slice(0, 10);
      const entry = byDay.get(day) ?? { day, visits: 0, minutes: 0, meters: 0 };
      entry.visits += 1;
      entry.minutes += actual || planned;
      entry.meters += meters;
      byDay.set(day, entry);
    }

    return {
      org,
      totals,
      deviations,
      staff: [...byStaff.values()].sort((a, b) => b.visits - a.visits),
      clients: [...byClient.values()].sort((a, b) => b.visits - a.visits),
      days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
      staffList: (staffRows ?? []) as Array<{ id: string; display_name: string | null }>,
      clientList: (clientRows ?? []) as Array<{ id: string; name: string }>,
    };
  });

/* ---------------- Smart schemaläggning ---------------- */

export type ScheduleProposal = {
  visitId: string;
  clientName: string;
  starts_at: string;
  ends_at: string;
  staffId: string;
  staffName: string;
  extraMeters: number;
  reason: string;
};

/** Föreslår vem som tar de obemannade besöken – kort körsträcka och kontinuitet först. */
export const suggestSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), date: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { from, to } = dayRange(data.date);

    const { data: visitRows } = await context.supabase
      .from("care_visits")
      .select("id, starts_at, ends_at, client_id, staff_id, status")
      .eq("org_id", org.id)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    const { data: clientRows } = await context.supabase
      .from("care_clients")
      .select("id, name, lat, lng")
      .eq("org_id", org.id);
    const { data: staffRows } = await context.supabase
      .from("org_members")
      .select("id, display_name")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .order("display_name");

    const visits = (visitRows ?? []) as Array<Record<string, any>>;
    const clients = new Map(
      ((clientRows ?? []) as Array<{ id: string; name: string; lat: number | null; lng: number | null }>).map(
        (c) => [c.id, c],
      ),
    );
    const staff = (staffRows ?? []) as Array<{ id: string; display_name: string | null }>;

    if (staff.length === 0) {
      return { proposals: [] as ScheduleProposal[], unassignable: visits.filter((v) => !v['staff_id']).length, savedMeters: 0 };
    }

    // Historik de senaste 30 dagarna för kontinuitet.
    const historyFrom = new Date(from);
    historyFrom.setDate(historyFrom.getDate() - 30);
    const { data: historyRows } = await context.supabase
      .from("care_visits")
      .select("client_id, staff_id")
      .eq("org_id", org.id)
      .gte("starts_at", historyFrom.toISOString())
      .lt("starts_at", from);
    const continuity = new Map<string, number>();
    for (const h of (historyRows ?? []) as Array<{ client_id: string; staff_id: string | null }>) {
      if (!h.staff_id) continue;
      const key = `${h.client_id}|${h.staff_id}`;
      continuity.set(key, (continuity.get(key) ?? 0) + 1);
    }

    type Slot = { end: number; lat: number | null; lng: number | null };
    const timeline = new Map<string, Slot[]>();
    for (const s of staff) timeline.set(s.id, []);
    for (const v of visits) {
      if (!v['staff_id'] || !timeline.has(v['staff_id'])) continue;
      const c = clients.get(v['client_id']);
      timeline.get(v['staff_id'])!.push({
        end: new Date(v['ends_at']).getTime(),
        lat: c?.lat ?? null,
        lng: c?.lng ?? null,
      });
    }

    const busy = new Map<string, Array<{ start: number; end: number }>>();
    for (const s of staff) busy.set(s.id, []);
    for (const v of visits) {
      if (!v['staff_id'] || !busy.has(v['staff_id'])) continue;
      busy.get(v['staff_id'])!.push({
        start: new Date(v['starts_at']).getTime(),
        end: new Date(v['ends_at']).getTime(),
      });
    }

    const proposals: ScheduleProposal[] = [];
    let unassignable = 0;
    let savedMeters = 0;

    const unassigned = visits
      .filter((v) => !v['staff_id'])
      .sort((a, b) => String(a['starts_at']).localeCompare(String(b['starts_at'])));

    for (const v of unassigned) {
      const client = clients.get(v['client_id']);
      const start = new Date(v['starts_at']).getTime();
      const end = new Date(v['ends_at']).getTime();

      let best: { id: string; name: string; score: number; meters: number; reason: string } | null =
        null;

      for (const s of staff) {
        const conflicts = (busy.get(s.id) ?? []).some((b) => start < b.end && end > b.start);
        if (conflicts) continue;

        const prev = (timeline.get(s.id) ?? [])
          .filter((slot) => slot.end <= start)
          .sort((a, b) => b.end - a.end)[0];
        const meters =
          prev && prev.lat != null && prev.lng != null && client?.lat != null && client?.lng != null
            ? haversine(
                { lat: prev.lat, lng: prev.lng },
                { lat: client.lat, lng: client.lng },
              )
            : 0;
        const known = continuity.get(`${v['client_id']}|${s.id}`) ?? 0;
        // Lägre poäng är bättre: avstånd minus bonus för känd personal.
        const score = meters - known * 800;
        const reason = known
          ? `Känner brukaren sedan tidigare (${known} besök)`
          : meters
            ? "Kortast körsträcka från föregående besök"
            : "Ledig tid i schemat";
        if (!best || score < best.score) {
          best = { id: s.id, name: s.display_name ?? "Namnlös", score, meters, reason };
        }
      }

      if (!best) {
        unassignable += 1;
        continue;
      }

      proposals.push({
        visitId: v['id'],
        clientName: client?.name ?? "Okänd brukare",
        starts_at: v['starts_at'],
        ends_at: v['ends_at'],
        staffId: best.id,
        staffName: best.name,
        extraMeters: best.meters,
        reason: best.reason,
      });
      savedMeters += best.meters;

      busy.get(best.id)!.push({ start, end });
      timeline.get(best.id)!.push({
        end,
        lat: client?.lat ?? null,
        lng: client?.lng ?? null,
      });
    }

    // Belastning per medarbetare efter förslaget.
    const load = staff.map((s) => {
      const slots = busy.get(s.id) ?? [];
      const minutes = slots.reduce((sum, b) => sum + (b.end - b.start) / 60000, 0);
      return { id: s.id, name: s.display_name ?? "Namnlös", visits: slots.length, minutes: Math.round(minutes) };
    });

    return { proposals, unassignable, savedMeters, load };
  });

/** Sparar valda schemaförslag. */
export const applySchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        assignments: z
          .array(z.object({ visitId: z.string().uuid(), staffId: z.string().uuid() }))
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    let saved = 0;
    for (const a of data.assignments) {
      const { error } = await context.supabase
        .from("care_visits")
        .update({ staff_id: a.staffId })
        .eq("id", a.visitId)
        .eq("org_id", org.id);
      if (!error) saved += 1;
    }
    return { saved };
  });
