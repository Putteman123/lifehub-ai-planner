import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Setup-adress för genvägarna på iPhone, med token maskerad tills den kopieras. */
export const getSmsWebhook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const token = process.env["SMS_INGEST_TOKEN"] ?? "";
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    return {
      configured: Boolean(token),
      url: token ? `${origin}/api/public/sms?token=${token}` : `${origin}/api/public/sms`,
    };
  });

/** Markerar inkommande SMS som lästa. */
export const markSmsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ids: z.array(z.string()) }).parse(input))
  .handler(async ({ data, context }) => {
    const { markSmsRead: mark } = await import("@/lib/sms.server");
    return mark(context.userId, data.ids);
  });

/** Avbryter ett meddelande som ligger och väntar i utkorgen. */
export const cancelOutboxSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sms_outbox")
      .update({ status: "cancelled" })
      .eq("user_id", context.userId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
