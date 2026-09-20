import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireOwner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_app_owner", { _user_id: context.userId });
  if (data !== true) throw new Error("Endast superadmin kan skicka utskick.");
}

export type CampaignRecipient = { email: string; name: string; org: string; source: string };

/** Alla mottagare superadmin kan välja mellan, grupperade per källa. */
export const listCampaignRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);

    const { data: leads } = await context.supabase
      .from("sales_leads")
      .select("contact_name, email, org_name")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: orgs } = await context.supabase
      .from("organizations")
      .select("name, contact_name, contact_email")
      .not("contact_email", "is", null);
    const { data: own } = await context.supabase
      .from("care_marketing_contacts")
      .select("name, email, org_name")
      .order("created_at", { ascending: false });

    const map = (
      rows: { name?: string | null; email?: string | null; org?: string | null }[],
      source: string,
    ): CampaignRecipient[] =>
      rows
        .filter((r) => !!r.email)
        .map((r) => ({
          email: String(r.email).trim().toLowerCase(),
          name: r.name?.trim() ?? "",
          org: r.org?.trim() ?? "",
          source,
        }));

    return {
      leads: map(
        (leads ?? []).map((l: any) => ({ name: l.contact_name, email: l.email, org: l.org_name })),
        "leads",
      ),
      customers: map(
        (orgs ?? []).map((o: any) => ({
          name: o.contact_name,
          email: o.contact_email,
          org: o.name,
        })),
        "customers",
      ),
      own: map(
        (own ?? []).map((c: any) => ({ name: c.name, email: c.email, org: c.org_name })),
        "own",
      ),
    };
  });

/** Lägger till egna mottagare, en per rad: "Namn <mejl>" eller bara mejl. */
export const addMarketingContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ text: z.string().max(20000) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const rows: { name: string | null; email: string; org_name: string | null }[] = [];
    for (const raw of data.text.split(/[\n;]+/)) {
      const line = raw.trim();
      if (!line) continue;
      const match = line.match(/^(.*?)[<,\s]+([^\s<>,]+@[^\s<>,]+\.[a-z]{2,})>?$/i);
      const email = (match?.[2] ?? line).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) continue;
      const name = (match?.[1] ?? "").replace(/[",<]/g, "").trim();
      rows.push({ name: name || null, email, org_name: null });
    }
    if (rows.length === 0) return { added: 0 };
    const { error } = await context.supabase
      .from("care_marketing_contacts")
      .upsert(rows, { onConflict: "email" });
    if (error) throw new Error(error.message);
    return { added: rows.length };
  });

export const removeMarketingContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    await context.supabase.from("care_marketing_contacts").delete().eq("email", data.email);
    return { ok: true };
  });

function fill(text: string, r: { name: string; org: string }) {
  return text
    .replaceAll("{namn}", r.name || "där")
    .replaceAll("{verksamhet}", r.org || "er verksamhet");
}

const sendSchema = z.object({
  subject: z.string().min(2).max(160),
  body: z.string().min(5).max(10000),
  recipients: z
    .array(
      z.object({
        email: z.string().email().max(160),
        name: z.string().max(160).default(""),
        org: z.string().max(160).default(""),
      }),
    )
    .min(1)
    .max(500),
  test: z.boolean().optional(),
});

/** Skickar utskicket ett mejl i taget och loggar resultatet per mottagare. */
export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sendSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    let campaignId: string | null = null;
    if (!data.test) {
      const { data: campaign } = await context.supabase
        .from("care_campaigns")
        .insert({ subject: data.subject, body: data.body, created_by: context.userId })
        .select("id")
        .single();
      campaignId = campaign?.id ?? null;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const log: { email: string; name: string | null; status: string; error: string | null }[] = [];

    for (const r of data.recipients) {
      const person = { name: r.name ?? "", org: r.org ?? "" };
      try {
        const result = await sendTemplateEmail("campaign", r.email, {
          templateData: {
            heading: fill(data.subject, person),
            message: fill(data.body, person),
          },
          ...(campaignId ? { idempotencyKey: `campaign-${campaignId}-${r.email}` } : {}),
        });
        if (result.sent) {
          sent++;
          log.push({ email: r.email, name: person.name, status: "sent", error: null });
        } else {
          skipped++;
          log.push({ email: r.email, name: person.name, status: "skipped", error: "avregistrerad" });
        }
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "okänt fel";
        log.push({ email: r.email, name: person.name, status: "failed", error: message });
      }
    }

    if (campaignId) {
      await context.supabase
        .from("care_campaigns")
        .update({ sent_count: sent, skipped_count: skipped, failed_count: failed })
        .eq("id", campaignId);
      await context.supabase
        .from("care_campaign_recipients")
        .insert(log.map((l) => ({ ...l, campaign_id: campaignId })));
    }

    return { sent, skipped, failed };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { data } = await context.supabase
      .from("care_campaigns")
      .select("id, subject, sent_count, skipped_count, failed_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
