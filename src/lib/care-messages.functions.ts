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
