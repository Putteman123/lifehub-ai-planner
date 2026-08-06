import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEVICE_TYPES = ["m3u", "mag", "protocol"] as const;
const SUBS = [1, 3, 6, 12, 99] as const;

const createSchema = z.object({
  customerName: z.string().min(1).max(80),
  deviceType: z.enum(DEVICE_TYPES),
  packageId: z.string().min(1).max(40),
  packageName: z.string().max(120).optional(),
  mac: z.string().max(40).optional(),
  months: z.number().int().refine((n) => (SUBS as readonly number[]).includes(n)),
  note: z.string().max(200).optional(),
});

/** Skapar en ny aktivering i panelen och sparar raden i appen. */
export const createIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { callPanel, extractLine } = await import("./iptv.server");

    if (data.deviceType === "mag" && !data.mac) {
      throw new Error("MAG-aktivering kräver en MAC-adress.");
    }

    const res = await callPanel({
      action: "new",
      type: data.deviceType,
      sub: String(data.months),
      pack: data.packageId,
      ...(data.mac ? { mac: data.mac } : {}),
      ...(data.note ? { note: data.note } : {}),
    });
    if (!res.ok) throw new Error(`Panelen svarade: ${res.message}`);

    const line = extractLine(res);
    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .insert({
        user_id: context.userId,
        customer_name: data.customerName,
        device_type: data.deviceType,
        package_id: data.packageId,
        package_name: data.packageName ?? null,
        months: data.months,
        note: data.note ?? null,
        panel_id: line.panelId,
        m3u_url: line.m3uUrl,
        username: line.username,
        password: line.password,
        mac: line.mac ?? data.mac ?? null,
        protocol_code: line.protocolCode,
        expires_at: line.expiresAt,
        last_response: res.raw as never,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { syncExpiryEvent } = await import("./iptv-calendar.server");
    await syncExpiryEvent(context.supabase, context.userId, row as never);

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
    const { callPanel } = await import("./iptv.server");

    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const line = row as typeof row & { mac: string | null };
    const params: Record<string, string> = {
      action: "renew",
      type: line.device_type,
      sub: String(data.months),
    };
    if (line.device_type === "mag") {
      if (!line.mac) throw new Error("Raden saknar MAC-adress och kan inte förnyas.");
      params["mac"] = line.mac;
    } else {
      if (!line.username || !line.password) {
        throw new Error("Raden saknar användarnamn/lösenord och kan inte förnyas.");
      }
      params["username"] = line.username;
      params["password"] = line.password;
    }

    const res = await callPanel(params);
    if (!res.ok) throw new Error(`Panelen svarade: ${res.message}`);

    const { error: updateError } = await context.supabase
      .from("iptv_lines")
      .update({ months: data.months, status: "aktiv", last_response: res.raw as never })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    return { message: res.message };
  });

/** Hämtar aktuell status från panelen och uppdaterar utgångsdatum m.m. */
export const refreshIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { callPanel, extractLine } = await import("./iptv.server");

    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const line = row as typeof row & { mac: string | null };
    const params: Record<string, string> = { action: "device_info" };
    if (line.device_type === "mag") {
      if (!line.mac) throw new Error("Raden saknar MAC-adress.");
      params["mac"] = line.mac;
    } else {
      if (!line.username || !line.password) throw new Error("Raden saknar inloggningsuppgifter.");
      params["username"] = line.username;
      params["password"] = line.password;
    }

    const res = await callPanel(params);
    if (!res.ok) throw new Error(`Panelen svarade: ${res.message}`);

    const info = extractLine(res);
    const enabled = res.data["enabled"];
    const { error: updateError } = await context.supabase
      .from("iptv_lines")
      .update({
        expires_at: info.expiresAt,
        m3u_url: info.m3uUrl ?? line.m3u_url,
        status: enabled === "0" || enabled === 0 ? "pausad" : "aktiv",
        online: !(enabled === "0" || enabled === 0),
        last_synced_at: new Date().toISOString(),
        last_response: res.raw as never,
      } as never)
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    const { syncExpiryEvent } = await import("./iptv-calendar.server");
    await syncExpiryEvent(context.supabase, context.userId, {
      id: data.id,
      customer_name: line.customer_name,
      expires_at: info.expiresAt,
    });

    return { message: res.message, expiresAt: info.expiresAt };

  });

/** Hälsokoll + paketlista: verifierar nyckeln och hämtar tillgängliga paket och krediter. */
export const getIptvPanelInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { callPanel, fetchBouquets } = await import("./iptv.server");

    const info = await callPanel({ action: "reseller_info" });
    if (!info.ok) {
      return { ok: false, message: info.message, credits: null, username: null, bouquets: [] };
    }

    const bouquets = await fetchBouquets();
    return {
      ok: true,
      message: info.message,
      credits: info.data["credits"] != null ? String(info.data["credits"]) : null,
      username: info.data["username"] != null ? String(info.data["username"]) : null,
      bouquets,
    };
  });

/** Importerar en linje som skapats direkt i panelen till appen. */
export const importIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        customerName: z.string().min(1).max(80),
        deviceType: z.enum(DEVICE_TYPES),
        username: z.string().max(80).optional(),
        password: z.string().max(120).optional(),
        mac: z.string().max(40).optional(),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { lookupLine } = await import("./iptv.server");
    const { syncExpiryEvent } = await import("./iptv-calendar.server");

    const res = await lookupLine({
      deviceType: data.deviceType,
      username: data.username ?? null,
      password: data.password ?? null,
      mac: data.mac ?? null,
    });
    if (!res.ok || !res.line) throw new Error(`Panelen svarade: ${res.message}`);

    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .insert({
        user_id: context.userId,
        customer_name: data.customerName,
        device_type: data.deviceType,
        months: 0,
        note: data.note ?? null,
        panel_id: res.line.panelId,
        username: res.line.username ?? data.username ?? null,
        password: res.line.password ?? data.password ?? null,
        mac: res.line.mac ?? data.mac ?? null,
        protocol_code: res.line.protocolCode,
        m3u_url: res.line.m3uUrl,
        expires_at: res.line.expiresAt,
        status: res.line.enabled ? "aktiv" : "pausad",
        online: res.line.enabled,
        last_synced_at: new Date().toISOString(),
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await syncExpiryEvent(context.supabase, context.userId, row as never);
    return { row };
  });

/** Uppdaterar kundnamn och anteckning för en linje (anteckningen följer raden). */
export const updateIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        customerName: z.string().min(1).max(80).optional(),
        note: z.string().max(200).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.customerName !== undefined) patch["customer_name"] = data.customerName;
    if (data.note !== undefined) patch["note"] = data.note;

    const { data: row, error } = await context.supabase
      .from("iptv_lines")
      .update(patch as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { syncExpiryEvent } = await import("./iptv-calendar.server");
    await syncExpiryEvent(context.supabase, context.userId, row as never);
    return { row };
  });

/** Tar bort raden ur appen och städar bort kalenderhändelsen. */
export const deleteIptvLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { removeExpiryEvent } = await import("./iptv-calendar.server");
    await removeExpiryEvent(context.supabase, context.userId, data.id);
    const { error } = await context.supabase.from("iptv_lines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Synkar alla linjer mot panelen och uppdaterar kalendern. */
export const syncIptvLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { lookupLine } = await import("./iptv.server");
    const { syncExpiryEvent } = await import("./iptv-calendar.server");

    const { data: rows, error } = await context.supabase.from("iptv_lines").select("*");
    if (error) throw new Error(error.message);

    let updated = 0;
    const failed: string[] = [];

    for (const raw of rows ?? []) {
      const line = raw as unknown as Record<string, string | null> & {
        id: string;
        customer_name: string;
      };
      const res = await lookupLine({
        deviceType: String(line["device_type"]),
        username: line["username"] ?? null,
        password: line["password"] ?? null,
        mac: line["mac"] ?? null,
      });

      if (!res.ok || !res.line) {
        failed.push(line.customer_name);
        continue;
      }

      const patch = {
        expires_at: res.line.expiresAt,
        m3u_url: res.line.m3uUrl ?? line["m3u_url"],
        panel_id: res.line.panelId ?? line["panel_id"],
        status: res.line.enabled ? "aktiv" : "pausad",
        online: res.line.enabled,
        last_synced_at: new Date().toISOString(),
      };
      await context.supabase.from("iptv_lines").update(patch as never).eq("id", line.id);
      await syncExpiryEvent(context.supabase, context.userId, {
        id: line.id,
        customer_name: line.customer_name,
        expires_at: res.line.expiresAt,
      });
      updated += 1;
    }

    return { updated, failed };
  });
