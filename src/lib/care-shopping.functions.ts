import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string; claims?: { email?: string } };

export type ShoppingItem = {
  id: string;
  client_id: string;
  title: string;
  quantity: string | null;
  note: string | null;
  amount: number | null;
  is_done: boolean;
  done_at: string | null;
  created_name: string | null;
  created_role: string | null;
  created_at: string;
};

/** Hämtar verksamheten via kortnamn och de brukare den inloggade får se. */
async function orgAndClients(ctx: Ctx, slug: string) {
  const { data: org, error } = await ctx.supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) throw new Error("Verksamheten hittades inte.");

  const { data: clients } = await ctx.supabase
    .from("care_clients")
    .select("id, name, address, phone")
    .eq("org_id", org.id)
    .eq("is_active", true)
    .order("name");

  return { org: org as { id: string; name: string; slug: string }, clients: (clients ?? []) as Array<{ id: string; name: string; address: string | null; phone: string | null }> };
}

/** Vem lägger till raden – används för att visa "tillagd av" i listan. */
async function describeMe(ctx: Ctx, orgId: string, clientId: string) {
  const { data: member } = await ctx.supabase
    .from("org_members")
    .select("display_name, role")
    .eq("org_id", orgId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (member) {
    return {
      name: member.display_name as string,
      role: member.role === "org_admin" ? "administrator" : "personal",
    };
  }
  const { data: relative } = await ctx.supabase
    .from("care_relatives")
    .select("name")
    .eq("client_id", clientId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (relative) return { name: relative.name as string, role: "anhorig" };

  const { data: client } = await ctx.supabase
    .from("care_clients")
    .select("name, user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (client?.user_id === ctx.userId) return { name: client.name as string, role: "brukare" };
  return { name: "Okänd", role: "personal" };
}

/** Inköpslistor för verksamhetens brukare. */
export const listShopping = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { org, clients } = await orgAndClients(ctx, data.slug);
    const { data: items } = await ctx.supabase
      .from("care_shopping_items")
      .select(
        "id, client_id, title, quantity, note, amount, is_done, done_at, created_name, created_role, created_at",
      )
      .eq("org_id", org.id)
      .order("is_done")
      .order("created_at", { ascending: false });
    return { org, clients, items: (items ?? []) as ShoppingItem[] };
  });

/** Lägger till en vara på en brukares inköpslista. */
export const addShoppingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        clientId: z.string().uuid(),
        title: z.string().min(1).max(160),
        quantity: z.string().max(60).optional(),
        note: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { org } = await orgAndClients(ctx, data.slug);
    const me = await describeMe(ctx, org.id, data.clientId);
    const { error } = await ctx.supabase.from("care_shopping_items").insert({
      org_id: org.id,
      client_id: data.clientId,
      title: data.title.trim(),
      quantity: data.quantity?.trim() || null,
      note: data.note?.trim() || null,
      created_by: ctx.userId,
      created_name: me.name,
      created_role: me.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bockar av (eller ångrar) en vara och kan spara belopp. */
export const setShoppingDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        done: z.boolean(),
        amount: z.number().nonnegative().max(100000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const patch: Record<string, unknown> = {
      is_done: data.done,
      done_at: data.done ? new Date().toISOString() : null,
      done_by: data.done ? ctx.userId : null,
    };
    if (data.amount !== undefined) patch["amount"] = data.amount;
    const { error } = await ctx.supabase
      .from("care_shopping_items")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tar bort en vara från listan. */
export const removeShoppingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { error } = await ctx.supabase.from("care_shopping_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
