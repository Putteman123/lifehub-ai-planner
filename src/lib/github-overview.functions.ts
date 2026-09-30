import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGithubOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { loadGithubOverview } = await import("./github-overview.server");
    return loadGithubOverview(context as never, { force: data.force === true });
  });
