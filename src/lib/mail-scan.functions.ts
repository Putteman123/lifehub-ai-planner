import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Söker igenom inkorgen efter fakturor, kortkvitton och prenumerationer och
 * lägger fynden i godkännandekön. Inget skrivs in i ekonomin här.
 */
export const scanMailForFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input?: { max?: number; query?: string; days?: number; attachments?: boolean }) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    const { scanInbox } = await import("./mail-scan.server");
    const opts: { max?: number; query?: string; days?: number; attachments?: boolean } = {};
    if (data.max !== undefined) opts.max = data.max;
    if (data.query !== undefined) opts.query = data.query;
    if (data.days !== undefined) opts.days = data.days;
    if (data.attachments !== undefined) opts.attachments = data.attachments;
    return scanInbox(context.supabase, context.userId, opts);
  });

/** Avfärdar ett fynd så att det inte föreslås igen. */
export const dismissMailFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mail_findings")
      .update({ status: "dismissed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Godkänner ett fynd: fakturor blir uppgifter i Att göra, kvitton blir
 * utgifter och prenumerationer blir fasta utgifter med kalendersynk.
 */
export const approveMailFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["faktura", "kvitto", "prenumeration"]),
        merchant: z.string().trim().min(1),
        amount: z.number().positive(),
        category: z.string().trim().nullable().default(null),
        dueDate: z.string().nullable().default(null),
        occurredAt: z.string().nullable().default(null),
        accountId: z.string().uuid().nullable().default(null),
        intervalMonths: z.number().int().min(1).max(12).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      status: string;
      created_todo_id?: string;
      created_spend_id?: string;
      created_expense_id?: string;
    } = { status: "approved" };
    let message = "";

    if (data.kind === "faktura") {
      const due = data.dueDate ? new Date(data.dueDate) : null;
      const dueIso = due && !Number.isNaN(due.getTime()) ? due.toISOString() : null;
      const { data: todo, error } = await supabase
        .from("todos")
        .insert({
          user_id: userId,
          title: `Betala ${data.merchant} – ${Math.round(data.amount)} kr`,
          notes: [
            data.category ? `Kategori: ${data.category}` : null,
            `Från inkorgen. mailbill:${data.id}`,
          ]
            .filter(Boolean)
            .join(" · "),
          due_date: dueIso,
          is_done: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      patch.created_todo_id = todo.id;
      message = "Fakturan ligger nu som uppgift i Att göra.";
    }

    if (data.kind === "kvitto") {
      const when = data.occurredAt ? new Date(data.occurredAt) : new Date();
      const { data: spend, error } = await supabase
        .from("spend_entries")
        .insert({
          user_id: userId,
          amount: data.amount,
          note: data.merchant,
          category: data.category,
          account_id: data.accountId,
          spent_at: (Number.isNaN(when.getTime()) ? new Date() : when).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      patch.created_spend_id = spend.id;

      if (data.accountId) {
        const { data: account } = await supabase
          .from("finance_accounts")
          .select("balance")
          .eq("id", data.accountId)
          .maybeSingle();
        if (account) {
          await supabase
            .from("finance_accounts")
            .update({ balance: Number(account.balance) - data.amount })
            .eq("id", data.accountId);
        }
      }
      message = "Köpet är registrerat som utgift.";
    }

    if (data.kind === "prenumeration") {
      const due = data.dueDate ? new Date(data.dueDate) : null;
      const dueDay =
        due && !Number.isNaN(due.getTime()) ? Math.min(Math.max(due.getDate(), 1), 28) : 1;
      const { data: expense, error } = await supabase
        .from("fixed_expenses")
        .insert({
          user_id: userId,
          name: data.merchant,
          amount: data.amount,
          due_day: dueDay,
          category: data.category ?? "Prenumeration",
          is_active: true,
          is_subscription: true,
          interval_months: data.intervalMonths,
          anchor_month:
            data.intervalMonths > 1 && due && !Number.isNaN(due.getTime())
              ? due.getMonth() + 1
              : null,
          sync_calendar: true,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      patch.created_expense_id = expense.id;

      const { syncFixedEvents } = await import("@/lib/fixed-calendar.server");
      await syncFixedEvents(supabase, userId, expense, []);
      message = "Prenumerationen är tillagd bland fasta utgifter.";
    }

    const { error: updateError } = await supabase
      .from("mail_findings")
      .update(patch)
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    return { ok: true as const, message };
  });
