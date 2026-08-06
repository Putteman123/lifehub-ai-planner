import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  customerName: z.string().min(1).max(80),
  deviceType: z.string().min(1).max(20).default("m3u"),
  packageId: z.string().min(1).max(40).default("all"),
  months: z.number().int().refine((n) => [1, 3, 6, 12, 99].includes(n)),
  note: z.string().max(200).optional(),
});

/** Skapar en ny aktivering i panelen och sparar raden i appen. */
export const createIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { callPanel, extractLine } = await import("./iptv.server");

    const res = await callPanel({
      action: "new",
      type: data.deviceType,
      sub: String(data.months),
      pack: data.packageId,
      ...(data.note ? { note: data.note } : {}),
    });
    if (!res.ok) throw new Error(`Panelen svarade: ${res.message}`);

    const line = extractLine(res.raw);
    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .insert({
        user_id: context.userId,
        customer_name: data.customerName,
        device_type: data.deviceType,
        package_id: data.packageId,
        months: data.months,
        note: data.note ?? null,
        panel_id: line.panelId,
        m3u_url: line.m3uUrl,
        username: line.username,
        password: line.password,
        expires_at: line.expiresAt,
        last_response: res.raw as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row, message: res.message };
  });

const renewSchema = z.object({
  id: z.string().uuid(),
  months: z.number().int().refine((n) => [1, 3, 6, 12].includes(n)),
});

/** Förnyar en befintlig aktivering i panelen och uppdaterar utgångsdatumet. */
export const renewIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => renewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { callPanel, extractLine } = await import("./iptv.server");

    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (!row.panel_id) throw new Error("Raden saknar panel-ID och kan inte förnyas automatiskt.");

    const res = await callPanel({
      action: "renew",
      type: row.device_type,
      sub: String(data.months),
      id: row.panel_id,
    });
    if (!res.ok) throw new Error(`Panelen svarade: ${res.message}`);

    const line = extractLine(res.raw);
    const { error: updateError } = await context.supabase
      .from("iptv_lines")
      .update({
        months: data.months,
        status: "aktiv",
        expires_at: line.expiresAt ?? row.expires_at,
        last_response: res.raw as never,
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
    return { message: res.message };
  });

/** Enkel hälsokoll: verifierar att API-nyckeln accepteras av panelen. */
export const checkIptvPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { callPanel } = await import("./iptv.server");
    const res = await callPanel({ action: "packages" });
    return { ok: res.ok, message: res.message };
  });
