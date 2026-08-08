import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const daySchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Kör AI-kartläggningen av en dag och sparar segmenten som förslag. */
export const analyzeDaySegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => daySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { analyzeDay } = await import("./day-mapping.server");
    return analyzeDay(context.userId, data.day);
  });

const idSchema = z.object({ id: z.string().uuid() });

/** Godkänner ett segment och skriver det till platsloggen. */
export const acceptDaySegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { acceptSegment } = await import("./day-mapping.server");
    return acceptSegment(context.userId, data.id);
  });
