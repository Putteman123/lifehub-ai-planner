import type { AiProvider } from "./ai-complete.server";

export type AiUsageEvent = {
  provider: AiProvider;
  feature: string;
  created_at: string;
};

export type AiUsageSlice = {
  total: number;
  providers: Record<AiProvider, number>;
};

export type AiUsageOverview = {
  today: AiUsageSlice;
  week: AiUsageSlice;
  month: AiUsageSlice;
  fetchedAt: string;
  trackingStartedAt: string | null;
};

type OwnerContext = {
  userId: string;
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    from: (table: string) => {
      select: (columns: string) => {
        gte: (column: string, value: string) => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};

const PROVIDERS: AiProvider[] = ["google", "openai", "perplexity", "lovable"];
const STOCKHOLM = "Europe/Stockholm";

function emptySlice(): AiUsageSlice {
  return { total: 0, providers: { google: 0, openai: 0, perplexity: 0, lovable: 0 } };
}

function dateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dayNumber(value: Date): number {
  const { year, month, day } = dateParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function aggregateAiUsage(events: AiUsageEvent[], now = new Date()): AiUsageOverview {
  const todayNumber = dayNumber(now);
  const weekday = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: STOCKHOLM, weekday: "short" }).format(now) === "Sun"
      ? 7
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
          new Intl.DateTimeFormat("en-US", { timeZone: STOCKHOLM, weekday: "short" }).format(now),
        ) + 1,
  );
  const weekStart = todayNumber - Math.max(0, weekday - 1);
  const nowParts = dateParts(now);
  const result = { today: emptySlice(), week: emptySlice(), month: emptySlice() };

  for (const event of events) {
    if (!PROVIDERS.includes(event.provider)) continue;
    const created = new Date(event.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const eventDay = dayNumber(created);
    const eventParts = dateParts(created);
    const add = (slice: AiUsageSlice) => {
      slice.total += 1;
      slice.providers[event.provider] += 1;
    };
    if (eventDay === todayNumber) add(result.today);
    if (eventDay >= weekStart && eventDay <= todayNumber) add(result.week);
    if (eventParts.year === nowParts.year && eventParts.month === nowParts.month) add(result.month);
  }

  const oldest = events
    .map((event) => event.created_at)
    .filter(Boolean)
    .sort()[0] ?? null;
  return { ...result, fetchedAt: now.toISOString(), trackingStartedAt: oldest };
}

export async function assertAiUsageOwner(context: OwnerContext): Promise<void> {
  let result: { data: unknown; error: unknown };
  try {
    result = await context.supabase.rpc("is_app_owner", { _user_id: context.userId });
  } catch {
    throw new Error("Endast superadmin har åtkomst.");
  }
  if (result.error || result.data !== true) throw new Error("Endast superadmin har åtkomst.");
}

export async function loadAiUsageOverview(context: OwnerContext, now = new Date()): Promise<AiUsageOverview> {
  await assertAiUsageOwner(context);
  const since = new Date(now.getTime() - 40 * 86_400_000).toISOString();
  const { data, error } = await context.supabase
    .from("ai_usage_events")
    .select("provider, feature, created_at")
    .gte("created_at", since);
  if (error) throw new Error("AI-förbrukningen kunde inte hämtas just nu.");
  return aggregateAiUsage((data ?? []) as AiUsageEvent[], now);
}

/** Registrerar endast metadata efter att ett svar har levererats. */
export async function recordAiUsage(provider: AiProvider, feature: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeFeature = feature.trim().slice(0, 80) || "general";
    const { error } = await supabaseAdmin.from("ai_usage_events").insert({ provider, feature: safeFeature });
    if (error) console.warn("AI-användningen kunde inte registreras:", error.message);
  } catch (error) {
    console.warn("AI-användningen kunde inte registreras:", error);
  }
}