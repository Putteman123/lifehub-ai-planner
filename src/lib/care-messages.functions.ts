import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string; claims?: { email?: string } };

/** Kopplar ihop inloggad anhörig med sina anhörigposter via e-postadressen. */
async function linkRelativeByEmail(context: Ctx) {
  const email = context.claims?.email?.toLowerCase();
  if (!email) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("care_relatives")
    .update({ user_id: context.userId })
    .is("user_id", null)
    .ilike("email", email);
}

/** Vem är jag i den här tråden – styr namn och roll på meddelandet. */
async function describeAuthor(context: Ctx, clientId: string) {
  const { data: client } = await context.supabase
    .from("care_clients")
    .select("id, name, org_id, user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) throw new Error("Brukaren hittades inte.");

  if (client.user_id === context.userId) {
    return { orgId: client.org_id as string, name: client.name as string, role: "brukare" };
  }

  const { data: member } = await context.supabase
    .from("org_members")
    .select("display_name, role")
    .eq("org_id", client.org_id)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (member) {
    return {
      orgId: client.org_id as string,
      name: member.display_name as string,
      role: member.role === "org_admin" ? "administrator" : "personal",
    };
  }

  const { data: relative } = await context.supabase
    .from("care_relatives")
    .select("name")
    .eq("client_id", clientId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (relative) {
    return { orgId: client.org_id as string, name: relative.name as string, role: "anhorig" };
  }

  return { orgId: client.org_id as string, name: "Administratör", role: "administrator" };
}

/** Meddelanden i en brukares tråd. RLS släpper bara in deltagarna. */
export const listCareMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await linkRelativeByEmail(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("care_messages")
      .select("id, body, author_id, author_name, author_role, created_at")
      .eq("client_id", data.clientId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { messages: rows ?? [], me: ctx.userId };
  });

/** Skickar ett meddelande i brukarens tråd. */
export const sendCareMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const author = await describeAuthor(ctx, data.clientId);
    const { error } = await ctx.supabase.from("care_messages").insert({
      org_id: author.orgId,
      client_id: data.clientId,
      author_id: ctx.userId,
      author_name: author.name,
      author_role: author.role,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Alla trådar den inloggade får läsa – för brukare, anhöriga och personal. */
export const listMyCareThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await linkRelativeByEmail(ctx);
    const { data: clients, error } = await ctx.supabase
      .from("care_clients")
      .select("id, name, org_id, organizations(name, slug)")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (clients ?? []).map((c: any) => ({
      id: c.id as string,
      name: c.name as string,
      orgName: (c.organizations?.name as string) ?? "",
      slug: (c.organizations?.slug as string) ?? "",
    }));
  });

/** Startar ett Google Meet-videosamtal för brukaren och delar länken i tråden. */
export const startCareMeet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const author = await describeAuthor(ctx, data.clientId);

    if (author.orgId === "a1f00000-0000-4000-8000-000000000001") {
      return { link: "https://meet.google.com/new" };
    }

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["GOOGLE_CALENDAR_API_KEY"];
    if (!lovableKey || !connectionKey) {
      throw new Error("Google-kalendern är inte kopplad ännu.");
    }

    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const res = await fetch(
      "https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connectionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: `Videosamtal – ${author.name}`,
          start: { dateTime: start.toISOString(), timeZone: "Europe/Stockholm" },
          end: { dateTime: end.toISOString(), timeZone: "Europe/Stockholm" },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Meet-anrop misslyckades [${res.status}]: ${body}`);
      throw new Error(`Kunde inte skapa videomötet [${res.status}]: ${body}`);
    }

    const event = (await res.json()) as {
      hangoutLink?: string;
      conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
    };
    const link =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;
    if (!link) throw new Error("Google gav ingen möteslänk.");

    const { error } = await ctx.supabase.from("care_messages").insert({
      org_id: author.orgId,
      client_id: data.clientId,
      author_id: ctx.userId,
      author_name: author.name,
      author_role: author.role,
      body: `Videosamtal startat: ${link}`,
    });
    if (error) throw new Error(error.message);

    return { link };
  });

/* ---------------- Kontakter och oläst ---------------- */

export type CareContact = {
  clientId: string;
  clientName: string;
  name: string;
  role: string;
  phone: string | null;
  orgName: string;
  slug: string;
  unread: number;
  lastAt: string | null;
  lastBody: string | null;
};

/** Alla personer den inloggade får kontakta – personal, brukare och anhöriga. */
export const listCareContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await linkRelativeByEmail(ctx);

    const { data: clients } = await ctx.supabase
      .from("care_clients")
      .select("id, name, phone, org_id, organizations(name, slug)")
      .eq("is_active", true)
      .order("name");
    const list = (clients ?? []) as any[];
    if (list.length === 0) return { contacts: [] as CareContact[], unread: 0 };

    const clientIds = list.map((c) => c.id as string);
    const orgIds = [...new Set(list.map((c) => c.org_id as string))];

    const { data: reads } = await ctx.supabase
      .from("care_message_reads")
      .select("client_id, read_at")
      .eq("user_id", ctx.userId);
    const readAt = new Map<string, string>(
      (reads ?? []).map((r: any) => [r.client_id as string, r.read_at as string]),
    );

    const { data: messages } = await ctx.supabase
      .from("care_messages")
      .select("client_id, body, created_at, author_id")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: relatives } = await ctx.supabase
      .from("care_relatives")
      .select("client_id, name, relation, phone")
      .in("client_id", clientIds);
    const { data: staff } = await ctx.supabase
      .from("org_members")
      .select("org_id, display_name, role, phone, is_active")
      .in("org_id", orgIds);

    const contacts: CareContact[] = [];
    let unreadTotal = 0;

    for (const c of list) {
      const since = readAt.get(c.id as string);
      const mine = (messages ?? []).filter((m: any) => m.client_id === c.id);
      const unread = mine.filter(
        (m: any) => m.author_id !== ctx.userId && (!since || m.created_at > since),
      ).length;
      unreadTotal += unread;
      const last = mine[0];
      const base = {
        clientId: c.id as string,
        clientName: c.name as string,
        orgName: (c.organizations?.name as string) ?? "",
        slug: (c.organizations?.slug as string) ?? "",
        unread,
        lastAt: (last?.created_at as string) ?? null,
        lastBody: (last?.body as string) ?? null,
      };

      contacts.push({ ...base, name: c.name as string, role: "Brukare", phone: c.phone ?? null });

      for (const r of (relatives ?? []).filter((r: any) => r.client_id === c.id)) {
        contacts.push({
          ...base,
          name: r.name as string,
          role: `Anhörig${r.relation ? ` – ${r.relation}` : ""}`,
          phone: (r.phone as string) ?? null,
        });
      }

      for (const s of (staff ?? []).filter((s: any) => s.org_id === c.org_id && s.is_active)) {
        contacts.push({
          ...base,
          name: s.display_name as string,
          role: s.role === "org_admin" ? "Verksamhetsadmin" : "Personal",
          phone: (s.phone as string) ?? null,
        });
      }
    }

    return { contacts, unread: unreadTotal };
  });

/** Markerar en brukares tråd som läst för mig. */
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { error } = await ctx.supabase.from("care_message_reads").upsert(
      { user_id: ctx.userId, client_id: data.clientId, read_at: new Date().toISOString() },
      { onConflict: "user_id,client_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
