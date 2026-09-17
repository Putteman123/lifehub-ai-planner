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
