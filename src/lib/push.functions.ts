import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

type Ctx = { supabase: any; userId: string };

function keys() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  return { lovableKey, connectionKey };
}

/** Skickar en notis till alla enheter användaren registrerat. */
async function pushToUser(
  ctx: Ctx,
  msg: { title: string; body: string; path?: string },
): Promise<{ sent: number; error?: string }> {
  const { lovableKey, connectionKey } = keys();
  if (!lovableKey || !connectionKey) {
    return { sent: 0, error: "Firebase är inte kopplat ännu." };
  }

  const { data: rows } = await ctx.supabase
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", ctx.userId);

  const tokens = (rows ?? []) as Array<{ id: string; token: string }>;
  if (tokens.length === 0) return { sent: 0, error: "Inga enheter är registrerade." };

  let sent = 0;
  let lastError: string | undefined;

  for (const row of tokens) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: row.token,
          notification: { title: msg.title, body: msg.body },
          data: { path: msg.path ?? "/" },
          webpush: {
            fcm_options: { link: msg.path ?? "/" },
            notification: { icon: "/icon-192.png" },
          },
        },
      }),
    });

    if (res.ok) {
      sent += 1;
      continue;
    }

    const text = await res.text();
    console.error(`[push] Utskick misslyckades [${res.status}]: ${text}`);
    lastError = text;
    if (res.status === 404 || res.status === 400) {
      await ctx.supabase.from("push_tokens").delete().eq("id", row.id);
    }
  }

  return sent > 0 ? { sent } : { sent: 0, error: lastError ?? "Utskicket misslyckades." };
}

export const savePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ token: z.string().min(10), platform: z.string().optional(), userAgent: z.string().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { error } = await ctx.supabase.from("push_tokens").upsert(
      {
        user_id: ctx.userId,
        token: data.token,
        platform: data.platform ?? null,
        user_agent: data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await ctx.supabase.from("push_tokens").delete().eq("user_id", ctx.userId).eq("token", data.token);
    return { ok: true };
  });

export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { connectionKey, lovableKey } = keys();
    const { data } = await ctx.supabase
      .from("push_tokens")
      .select("id, platform, last_seen_at")
      .eq("user_id", ctx.userId)
      .order("last_seen_at", { ascending: false });
    return {
      connected: Boolean(connectionKey && lovableKey),
      devices: (data ?? []) as Array<{ id: string; platform: string | null; last_seen_at: string }>,
    };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return pushToUser(context as unknown as Ctx, {
      title: "LifeHub",
      body: "Testnotis – pushnotiser fungerar.",
      path: "/dashboard",
    });
  });

export const sendPushToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ title: z.string().min(1), body: z.string().default(""), path: z.string().default("/") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    return pushToUser(context as unknown as Ctx, data);
  });
