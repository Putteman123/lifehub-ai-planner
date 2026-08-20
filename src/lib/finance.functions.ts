import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Läser av ett uppladdat kvitto/faktura med Andrea och returnerar tolkningen. */
export const analyzeReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32),
        mimeType: z.string().default("image/jpeg"),
        fileName: z.string().default("kvitto"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");

    const { data: rows } = await context.supabase
      .from("spend_entries")
      .select("category")
      .not("category", "is", null)
      .order("spent_at", { ascending: false })
      .limit(120);

    const knownCategories = [
      ...new Set((rows ?? []).map((row) => (row.category ?? "").trim()).filter(Boolean)),
    ].slice(0, 20);

    const { readReceipt } = await import("@/lib/finance-ai.server");
    return readReceipt({
      apiKey,
      dataUrl: data.dataUrl,
      mimeType: data.mimeType,
      fileName: data.fileName,
      knownCategories,
    });
  });

/**
 * Markerar butiken från ett kvitto som ett besök i platsloggen, så att köpet
 * syns på kartan och i "Min dag".
 */
export const logReceiptVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        merchant: z.string().trim().min(1),
        address: z.string().trim().optional(),
        spentAt: z.string().min(10),
        amount: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveAddressPoint } = await import("./maps.server");
    const query = [data.address, data.merchant].filter(Boolean).join(", ");
    const point =
      (await resolveAddressPoint(query)) ??
      (data.address ? null : await resolveAddressPoint(`${data.merchant}, Sverige`));

    if (!point) {
      return { ok: false as const, message: "Hittade ingen adress för butiken." };
    }

    const arrived = new Date(data.spentAt);
    const left = new Date(arrived.getTime() + 15 * 60_000);

    // Finns redan ett besök samma dag på samma butik? Skriv inte dubbelt.
    const dayStart = new Date(arrived);
    dayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await context.supabase
      .from("visits")
      .select("id")
      .eq("label", data.merchant)
      .gte("arrived_at", dayStart.toISOString())
      .lte("arrived_at", new Date(dayStart.getTime() + 86_400_000).toISOString())
      .limit(1);
    if (existing?.length) {
      return { ok: true as const, message: "Besöket fanns redan på kartan.", ...point };
    }

    const { data: places } = await context.supabase.from("places").select("*");
    const { matchPlace } = await import("./geo");
    const place = matchPlace(places ?? [], point.lat, point.lng);

    const { error } = await context.supabase.from("visits").insert({
      user_id: context.userId,
      place_id: place?.id ?? null,
      label: data.merchant,
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      arrived_at: arrived.toISOString(),
      left_at: left.toISOString(),
      entry_kind: "besok",
      distance_m: 0,
      travel_mode: "okant",
      source: "kvitto",
      is_manual: false,
      note: data.amount ? `Köp ${Math.round(data.amount)} kr` : null,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, message: `${data.merchant} markerad på kartan.`, ...point };
  });

/**
 * Lägger automatiskt in ett kalenderhändelse för kvittot när det finns ett
 * datum och/eller en plats att utgå från.
 */
export const logReceiptEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        merchant: z.string().trim().optional(),
        address: z.string().trim().optional(),
        spentAt: z.string().min(10),
        amount: z.number().optional(),
        category: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const place = data.address?.trim() || data.merchant?.trim() || "";
    const when = new Date(data.spentAt);
    if (Number.isNaN(when.getTime())) {
      return { ok: false as const, message: "Kvittot saknar giltigt datum." };
    }
    if (!place && !data.spentAt) {
      return { ok: false as const, message: "Kvittot saknade både datum och plats." };
    }

    const title = data.merchant?.trim()
      ? `Köp – ${data.merchant.trim()}${data.amount ? ` (${Math.round(data.amount)} kr)` : ""}`
      : `Köp${data.amount ? ` ${Math.round(data.amount)} kr` : ""}`;
    const ends = new Date(when.getTime() + 30 * 60_000);

    const dayStart = new Date(when);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const { data: existing } = await context.supabase
      .from("events")
      .select("id")
      .eq("title", title)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .limit(1);
    if (existing?.length) {
      return { ok: true as const, message: "Händelsen fanns redan i kalendern." };
    }

    const { error } = await context.supabase.from("events").insert({
      user_id: context.userId,
      title,
      description: data.category ? `Kategori: ${data.category}` : "Skapad från kvitto",
      location: place || null,
      starts_at: when.toISOString(),
      ends_at: ends.toISOString(),
      all_day: false,
      category: "privat",
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, message: "Kvittot lades till i kalendern." };
  });


/** Kort AI-analys av utgifterna i förhållande till dagsbudgeten. */
export const financeInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ perDay: z.number(), days: z.number() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: spends }, { data: fixed }] = await Promise.all([
      context.supabase
        .from("spend_entries")
        .select("amount, category, note, spent_at")
        .gte("spent_at", since)
        .order("spent_at", { ascending: false })
        .limit(150),
      context.supabase.from("fixed_expenses").select("name, amount").eq("is_active", true),
    ]);

    const lines = (spends ?? [])
      .map(
        (row) =>
          `${row.spent_at.slice(0, 10)} ${Number(row.amount)} kr ${row.category ?? "okänt"}${
            row.note ? ` (${row.note})` : ""
          }`,
      )
      .join("\n");
    const fixedLine = (fixed ?? [])
      .map((row) => `${row.name} ${Number(row.amount)} kr`)
      .join(", ");

    const { completeText } = await import("@/lib/ai-complete.server");
    const text = await completeText({
      apiKey,
      system:
        "Du är Andrea, en varm och konkret svensk ekonomiassistent. Svara med högst tre korta punkter (max 20 ord per punkt) om utgiftsmönster och ett konkret spartips. Ingen inledning, inga rubriker.",
      input: `Dagsbudget: ${Math.round(data.perDay)} kr i ${data.days} dagar.\nFasta utgifter: ${
        fixedLine || "inga"
      }.\nUtgifter senaste 30 dagarna:\n${lines || "inga registrerade"}`,
    });

    return { text };
  });

/** Läser av en spelkupong (ATG) och returnerar spelform, insats och datum. */
export const analyzeBetSlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32),
        mimeType: z.string().default("image/jpeg"),
        fileName: z.string().default("kupong"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");
    const { readBetSlip } = await import("@/lib/finance-ai.server");
    return readBetSlip({
      apiKey,
      dataUrl: data.dataUrl,
      mimeType: data.mimeType,
      fileName: data.fileName,
    });
  });

/** Markerar (eller ångrar) en fast utgift som betald för en viss månad. */
export const setFixedPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        expenseId: z.string().uuid(),
        period: z.string().regex(/^\d{4}-\d{2}$/),
        paid: z.boolean(),
        amount: z.number().optional(),
        paidOn: z.string().optional(),
        source: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Uppdaterar kalendertitlarna (bock framför betalda månader).
    const refreshCalendar = async () => {
      const { data: expense } = await supabase
        .from("fixed_expenses")
        .select("*")
        .eq("id", data.expenseId)
        .maybeSingle();
      if (!expense) return;
      const { data: paid } = await supabase
        .from("fixed_expense_payments")
        .select("period")
        .eq("expense_id", data.expenseId);
      const { syncFixedEvents } = await import("@/lib/fixed-calendar.server");
      await syncFixedEvents(supabase, userId, expense, (paid ?? []).map((p) => p.period));
    };

    if (!data.paid) {
      const { error } = await supabase
        .from("fixed_expense_payments")
        .delete()
        .eq("expense_id", data.expenseId)
        .eq("period", data.period);
      if (error) throw new Error(error.message);
      await refreshCalendar();
      return { ok: true as const, paid: false };
    }

    const { data: expense } = await supabase
      .from("fixed_expenses")
      .select("amount")
      .eq("id", data.expenseId)
      .maybeSingle();

    const { error } = await supabase.from("fixed_expense_payments").upsert(
      {
        user_id: userId,
        expense_id: data.expenseId,
        period: data.period,
        amount: data.amount ?? Number(expense?.amount ?? 0),
        paid_on: (data.paidOn ?? new Date().toISOString()).slice(0, 10),
        source: data.source ?? "manuell",
      },
      { onConflict: "expense_id,period" },
    );
    if (error) throw new Error(error.message);

    // Städa bort ev. restskuldsuppgift för samma månad.
    await supabase
      .from("todos")
      .delete()
      .eq("user_id", userId)
      .like("notes", `%fixed:${data.expenseId}:${data.period}%`);

    await refreshCalendar();
    return { ok: true as const, paid: true };
  });


/**
 * Matchar en uppladdad faktura mot de fasta utgifterna med Andrea och
 * returnerar bästa förslaget att markera som betalt.
 */
export const matchInvoiceToFixed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        merchant: z.string().trim().default(""),
        amount: z.number().nullable().default(null),
        paidOn: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("fixed_expenses")
      .select("*")
      .eq("is_active", true);

    const expenses = rows ?? [];
    if (!expenses.length) return { match: null as null | { id: string; name: string; score: number; why: string } };

    const { matchScore } = await import("@/lib/fixed-expenses");
    const scored = expenses
      .map((row) => ({
        row,
        score: matchScore(row, { text: data.merchant, amount: data.amount }),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 0.3) return { match: null };

    return {
      match: {
        id: best.row.id,
        name: best.row.name,
        score: best.score,
        why:
          best.score >= 0.9
            ? "Både mottagare och belopp stämmer."
            : best.score >= 0.6
              ? "Mottagaren stämmer med din fasta utgift."
              : "Beloppet ligger nära din fasta utgift.",
      },
    };
  });

/**
 * Skapar rödmarkerade uppgifter för fasta utgifter som inte betalades
 * föregående månader, och tar bort uppgifter som betalats.
 */
export const syncFixedCarryOver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: expenses }, { data: payments }, { data: todos }] = await Promise.all([
      supabase.from("fixed_expenses").select("*").eq("is_active", true),
      supabase.from("fixed_expense_payments").select("*"),
      supabase.from("todos").select("id, notes, is_done").like("notes", "%fixed:%"),
    ]);

    const { fixedViews, fixedTodoMarker, periodLabel } = await import("@/lib/fixed-expenses");
    const views = fixedViews(expenses ?? [], payments ?? []);

    const wanted = new Map<string, { title: string; notes: string }>();
    for (const view of views) {
      for (const period of view.carryOver) {
        const marker = fixedTodoMarker(view.row.id, period);
        wanted.set(marker, {
          title: `Obetald: ${view.row.name} (${periodLabel(period)})`,
          notes: `${Math.round(Number(view.row.amount))} kr från ${period}. ${marker}`,
        });
      }
    }

    const existing = new Map<string, string>();
    for (const todo of todos ?? []) {
      const marker = /fixed:[0-9a-f-]{36}:\d{4}-\d{2}/i.exec(todo.notes ?? "")?.[0];
      if (marker) existing.set(marker, todo.id);
    }

    const inserts = [...wanted.entries()]
      .filter(([marker]) => !existing.has(marker))
      .map(([, value]) => ({
        user_id: userId,
        title: value.title,
        notes: value.notes,
        is_done: false,
      }));
    if (inserts.length) await supabase.from("todos").insert(inserts);

    const stale = [...existing.entries()]
      .filter(([marker]) => !wanted.has(marker))
      .map(([, id]) => id);
    if (stale.length) await supabase.from("todos").delete().in("id", stale);

    return { created: inserts.length, removed: stale.length };
  });

/** Sparar en fast utgift/prenumeration och håller kalendern i synk. */
export const saveFixedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1),
        amount: z.number(),
        due_day: z.number().int().min(1).max(28),
        category: z.string().trim().nullable().default(null),
        is_active: z.boolean().default(true),
        is_subscription: z.boolean().default(false),
        interval_months: z.number().int().min(1).max(12).default(1),
        anchor_month: z.number().int().min(1).max(12).nullable().default(null),
        sync_calendar: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const payload = id ? { ...rest, id, user_id: userId } : { ...rest, user_id: userId };

    const { data: saved, error } = await supabase
      .from("fixed_expenses")
      .upsert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { data: payments } = await supabase
      .from("fixed_expense_payments")
      .select("period")
      .eq("expense_id", saved.id);

    const { syncFixedEvents } = await import("@/lib/fixed-calendar.server");
    await syncFixedEvents(
      supabase,
      userId,
      saved,
      (payments ?? []).map((p) => p.period),
    );

    return { ok: true as const, id: saved.id as string };
  });

/** Tar bort en fast utgift och dess kalenderhändelser. */
export const deleteFixedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { removeFixedEvents } = await import("@/lib/fixed-calendar.server");
    await removeFixedEvents(supabase, userId, data.id);
    const { error } = await supabase.from("fixed_expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Synkar kalenderhändelser för alla aktiva fasta utgifter (körs vid sidladdning). */
export const syncFixedCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: expenses }, { data: payments }] = await Promise.all([
      supabase.from("fixed_expenses").select("*"),
      supabase.from("fixed_expense_payments").select("expense_id, period"),
    ]);

    const { syncFixedEvents } = await import("@/lib/fixed-calendar.server");
    let created = 0;
    let removed = 0;
    for (const row of expenses ?? []) {
      const paid = (payments ?? [])
        .filter((p) => p.expense_id === row.id)
        .map((p) => p.period);
      const res = await syncFixedEvents(supabase, userId, row, paid);
      created += res.created;
      removed += res.removed;
    }
    return { created, removed };
  });
