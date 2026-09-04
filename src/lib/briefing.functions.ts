import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dagens AI-briefing baserad på kalender, uppgifter och ekonomi. */
export const dailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildBriefing } = await import("./briefing.server");
    return buildBriefing(context.supabase, context.userId);
  });

/** Kort ekonomicoach för veckan. */
export const moneyCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildMoneyCoach } = await import("./briefing.server");
    return buildMoneyCoach(context.supabase, context.userId);
  });
