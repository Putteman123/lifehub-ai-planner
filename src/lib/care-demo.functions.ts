import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Kortnamn som får visas i den publika demon. */
const DEMO_SLUGS = ["alfa-demo"];
const DEMO_PIN = "0000";

const demoInput = z.object({
  slug: z.string().min(1).max(60),
  pin: z.string().min(1).max(10),
});

/** Publik, skrivskyddad demo av ett testföretag – skyddad med pinkod. */
export const getDemoCompany = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => demoInput.parse(d))
  .handler(async ({ data }) => {
    if (!DEMO_SLUGS.includes(data.slug)) throw new Error("Demon hittades inte.");
    if (data.pin !== DEMO_PIN) throw new Error("Fel pinkod.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) throw new Error("Demon hittades inte.");

    const [{ data: members }, { data: clients }, { data: medications }] = await Promise.all([
      supabaseAdmin
        .from("org_members")
        .select("id, display_name, role, employment, work_hours, is_active")
        .eq("org_id", org.id)
        .order("display_name"),
      supabaseAdmin
        .from("care_clients")
        .select("id, name, address, is_active")
        .eq("org_id", org.id)
        .order("name"),
      supabaseAdmin
        .from("care_medications")
        .select("id, client_id, name, dose, times, requires_delegation")
        .eq("org_id", org.id)
        .eq("is_active", true),
    ]);

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: visitRows } = await supabaseAdmin
      .from("care_visits")
      .select("id, client_id, staff_id, starts_at, ends_at, status, travel_meters, deviation, title")
      .eq("org_id", org.id)
      .gte("starts_at", since)
      .order("starts_at");

    type VisitRow = {
      id: string;
      client_id: string | null;
      staff_id: string | null;
      starts_at: string;
      ends_at: string;
      status: string;
      travel_meters: number | null;
      deviation: string | null;
      title: string | null;
    };
    const visits = (visitRows ?? []) as VisitRow[];

    const blank = () => ({
      visits: 0,
      done: 0,
      missed: 0,
      planned: 0,
      minutes: 0,
      meters: 0,
      deviations: 0,
    });
    type Stat = ReturnType<typeof blank>;
    const total = blank();
    const staff: Record<string, Stat> = {};
    const perClient: Record<string, Stat> = {};

    for (const v of visits) {
      const minutes = Math.max(
        0,
        Math.round((new Date(v.ends_at).getTime() - new Date(v.starts_at).getTime()) / 60000),
      );
      const apply = (s: Stat) => {
        s.visits += 1;
        s.minutes += minutes;
        s.meters += v.travel_meters ?? 0;
        if (v.status === "utfort") s.done += 1;
        else if (v.status === "uteblivet") s.missed += 1;
        else s.planned += 1;
        if (v.deviation) s.deviations += 1;
      };
      apply(total);
      if (v.staff_id) apply((staff[v.staff_id] ??= blank()));
      if (v.client_id) apply((perClient[v.client_id] ??= blank()));
    }

    const today = new Date().toISOString().slice(0, 10);
    const todaysVisits = visits
      .filter((v) => v.starts_at.slice(0, 10) === today)
      .slice(0, 25)
      .map((v) => ({
        id: v.id,
        client_id: v.client_id,
        staff_id: v.staff_id,
        starts_at: v.starts_at,
        ends_at: v.ends_at,
        status: v.status,
        title: v.title,
      }));

    return {
      org: { name: org.name, slug: org.slug },
      members: members ?? [],
      clients: clients ?? [],
      medications: medications ?? [],
      stats: { total, staff, clients: perClient, days: 30 },
      todaysVisits,
    };
  });
