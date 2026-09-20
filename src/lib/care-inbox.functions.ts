import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Alla inkorgsfunktioner är bara till för systemägaren (superadmin). */
async function requireOwner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_app_owner", { _user_id: context.userId });
  if (data !== true) throw new Error("Endast superadmin har tillgång till inkorgen.");
}

export type InboxThread = {
  id: string;
  source: string;
  from_name: string;
  from_email: string;
  org_name: string | null;
  subject: string;
  status: string;
  unread: boolean;
  last_message_at: string;
};

export const listInboxThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { data: threads } = await context.supabase
      .from("care_inbox_threads")
      .select("id, source, from_name, from_email, org_name, subject, status, unread, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(200);
    const { data: settings } = await context.supabase
      .from("care_inbox_settings")
      .select("forward_email, forward_enabled")
      .limit(1)
      .maybeSingle();
    return {
      threads: (threads ?? []) as InboxThread[],
      settings: {
        forward_email: settings?.forward_email ?? "",
        forward_enabled: settings?.forward_enabled ?? true,
      },
    };
  });

export const getInboxThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { data: thread } = await context.supabase
      .from("care_inbox_threads")
      .select("id, source, from_name, from_email, org_name, subject, status, unread, last_message_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!thread) throw new Error("Tråden hittades inte.");
    const { data: messages } = await context.supabase
      .from("care_inbox_messages")
      .select("id, direction, body, created_at")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true });
    if (thread.unread) {
      await context.supabase.from("care_inbox_threads").update({ unread: false }).eq("id", data.id);
    }
    return { thread: thread as InboxThread, messages: messages ?? [] };
  });

export const replyToThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().min(2).max(5000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { data: thread } = await context.supabase
      .from("care_inbox_threads")
      .select("id, from_name, from_email, subject")
      .eq("id", data.id)
      .maybeSingle();
    if (!thread) throw new Error("Tråden hittades inte.");

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("inbox-reply", thread.from_email, {
      templateData: {
        contactName: thread.from_name,
        message: data.body,
        subject: `Re: ${thread.subject}`,
      },
    });

    await context.supabase.from("care_inbox_messages").insert({
      thread_id: data.id,
      direction: "out",
      body: data.body,
      created_by: context.userId,
    });
    await context.supabase
      .from("care_inbox_threads")
      .update({ status: "pagar", unread: false, last_message_at: new Date().toISOString() })
      .eq("id", data.id);

    return { sent: result.sent };
  });

export const setThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["ny", "pagar", "klar"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    await context.supabase
      .from("care_inbox_threads")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    await context.supabase.from("care_inbox_threads").delete().eq("id", data.id);
    return { ok: true };
  });

export const saveInboxSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        forward_email: z.string().email().max(160).or(z.literal("")),
        forward_enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    await context.supabase.from("care_inbox_settings").upsert({
      id: true,
      forward_email: data.forward_email === "" ? null : data.forward_email,
      forward_enabled: data.forward_enabled,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });
