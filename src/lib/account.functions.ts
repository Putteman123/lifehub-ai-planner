import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Kontoöverföring: appen kördes tidigare mot ett gemensamt konto som låstes upp
 * med pinkod. Första gången du loggar in med Google flyttas all befintlig data
 * över till ditt personliga konto – därefter är kontot låst till dig.
 */
export const claimMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { migrateUserData } = await import("@/lib/account.server");

    const { data: owner } = await supabaseAdmin
      .from("app_owner")
      .select("user_id")
      .maybeSingle();

    if (owner?.user_id === userId) return { ok: true as const, moved: 0, alreadyOwner: true };
    if (owner?.user_id) return { ok: false as const, reason: "annat-konto" as const };

    const legacyEmail = process.env["APP_OWNER_EMAIL"];
    let legacyId: string | null = null;
    if (legacyEmail) {
      const { data: legacy } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", legacyEmail)
        .maybeSingle();
      legacyId = legacy?.id ?? null;
    }

    let moved = 0;
    if (legacyId && legacyId !== userId) {
      moved = await migrateUserData(legacyId, userId);
    }

    await supabaseAdmin.from("app_owner").upsert({ id: true, user_id: userId });

    return { ok: true as const, moved, alreadyOwner: false };
  });

/** Enkel koll om det inloggade kontot äger appens data. */
export const myAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: owner } = await supabaseAdmin
      .from("app_owner")
      .select("user_id")
      .maybeSingle();
    return {
      isOwner: owner?.user_id === context.userId,
      hasOwner: Boolean(owner?.user_id),
    };
  });
