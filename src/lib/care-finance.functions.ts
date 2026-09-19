import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrg, type Ctx } from "@/lib/care-admin.functions";

export type FinanceSettings = {
  hourly_rate: number;
  staff_cost_per_hour: number;
  travel_cost_per_km: number;
};

export type FinanceRow = {
  id: string;
  name: string;
  hours: number;
  visits: number;
  missed: number;
  km: number;
  amount: number;
};

export type FinanceTotals = {
  visits: number;
  done: number;
  missed: number;
  hours: number;
  km: number;
  revenue: number;
  staffCost: number;
  travelCost: number;
  result: number;
};

const DEFAULTS: FinanceSettings = {
  hourly_rate: 480,
  staff_cost_per_hour: 280,
  travel_cost_per_km: 25,
};

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1));
  const to = new Date(Date.UTC(y ?? 2026, m ?? 1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

function round(v: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Ekonomisk översikt för en månad: intäkt, kostnad och resultat. */
export const getCareFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        month: z.string().regex(/^\d{4}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: settingsRow } = await context.supabase
      .from("care_org_finance")
      .select("hourly_rate, staff_cost_per_hour, travel_cost_per_km")
      .eq("org_id", org.id)
      .maybeSingle();
    const settings: FinanceSettings = settingsRow
      ? {
          hourly_rate: Number(settingsRow.hourly_rate),
          staff_cost_per_hour: Number(settingsRow.staff_cost_per_hour),
          travel_cost_per_km: Number(settingsRow.travel_cost_per_km),
        }
      : DEFAULTS;

    const { data: members } = await context.supabase
      .from("org_members")
      .select("id, display_name")
      .eq("org_id", org.id);
    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name")
      .eq("org_id", org.id);

    const staffName = new Map<string, string>(
      (members ?? []).map((m: any) => [m.id as string, m.display_name as string]),
    );
    const clientName = new Map<string, string>(
      (clients ?? []).map((c: any) => [c.id as string, c.name as string]),
    );

    // 12 månader bakåt räcker för både månadsvy och trend.
    const trendFrom = monthRange(data.month).from;
    const start = new Date(trendFrom);
    start.setUTCMonth(start.getUTCMonth() - 11);
    const { to } = monthRange(data.month);

    const { data: visitRows } = await context.supabase
      .from("care_visits")
      .select("id, client_id, staff_id, starts_at, ends_at, status, travel_meters")
      .eq("org_id", org.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", to);

    type Row = {
      client_id: string | null;
      staff_id: string | null;
      starts_at: string;
      ends_at: string;
      status: string;
      travel_meters: number | null;
    };
    const visits = (visitRows ?? []) as Row[];
    const { from } = monthRange(data.month);

    const totals: FinanceTotals = {
      visits: 0,
      done: 0,
      missed: 0,
      hours: 0,
      km: 0,
      revenue: 0,
      staffCost: 0,
      travelCost: 0,
      result: 0,
    };
    const byClient = new Map<string, FinanceRow>();
    const byStaff = new Map<string, FinanceRow>();
    const trend = new Map<string, { revenue: number; cost: number }>();

    for (const v of visits) {
      const hours =
        Math.max(0, new Date(v.ends_at).getTime() - new Date(v.starts_at).getTime()) / 3600000;
      const km = (v.travel_meters ?? 0) / 1000;
      const done = v.status === "utfort";
      const revenue = done ? hours * settings.hourly_rate : 0;
      const cost = done ? hours * settings.staff_cost_per_hour + km * settings.travel_cost_per_km : 0;

      const monthKey = new Date(v.starts_at).toISOString().slice(0, 7);
      const t = trend.get(monthKey) ?? { revenue: 0, cost: 0 };
      t.revenue += revenue;
      t.cost += cost;
      trend.set(monthKey, t);

      if (v.starts_at < from) continue;

      totals.visits += 1;
      if (done) totals.done += 1;
      if (v.status === "uteblivet") totals.missed += 1;
      if (done) {
        totals.hours += hours;
        totals.km += km;
        totals.revenue += revenue;
        totals.staffCost += hours * settings.staff_cost_per_hour;
        totals.travelCost += km * settings.travel_cost_per_km;
      }

      const push = (
        map: Map<string, FinanceRow>,
        id: string | null,
        name: string,
        amount: number,
      ) => {
        if (!id) return;
        const row = map.get(id) ?? { id, name, hours: 0, visits: 0, missed: 0, km: 0, amount: 0 };
        row.visits += 1;
        if (v.status === "uteblivet") row.missed += 1;
        if (done) {
          row.hours += hours;
          row.km += km;
          row.amount += amount;
        }
        map.set(id, row);
      };

      push(byClient, v.client_id, clientName.get(v.client_id ?? "") ?? "Okänd brukare", revenue);
      push(
        byStaff,
        v.staff_id,
        staffName.get(v.staff_id ?? "") ?? "Okänd medarbetare",
        hours * settings.staff_cost_per_hour + km * settings.travel_cost_per_km,
      );
    }

    totals.result = totals.revenue - totals.staffCost - totals.travelCost;

    const clean = (rows: FinanceRow[]) =>
      rows
        .map((r) => ({ ...r, hours: round(r.hours), km: round(r.km), amount: Math.round(r.amount) }))
        .sort((a, b) => b.amount - a.amount);

    return {
      org,
      month: data.month,
      settings,
      totals: {
        ...totals,
        hours: round(totals.hours),
        km: round(totals.km),
        revenue: Math.round(totals.revenue),
        staffCost: Math.round(totals.staffCost),
        travelCost: Math.round(totals.travelCost),
        result: Math.round(totals.result),
      },
      clients: clean([...byClient.values()]),
      staff: clean([...byStaff.values()]),
      trend: [...trend.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month, result: Math.round(v.revenue - v.cost) })),
    };
  });

/** Sparar timpris, timkostnad och reseersättning för verksamheten. */
export const saveCareFinanceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        hourly_rate: z.number().min(0).max(100000),
        staff_cost_per_hour: z.number().min(0).max(100000),
        travel_cost_per_km: z.number().min(0).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_org_finance").upsert(
      {
        org_id: org.id,
        hourly_rate: data.hourly_rate,
        staff_cost_per_hour: data.staff_cost_per_hour,
        travel_cost_per_km: data.travel_cost_per_km,
      },
      { onConflict: "org_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
