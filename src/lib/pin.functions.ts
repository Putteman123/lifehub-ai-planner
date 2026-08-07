import { createServerFn } from "@tanstack/react-start";

/**
 * Appen är öppen – ingen pinkod. Servern skapar en engångstoken för
 * ägarkontot så att all data (RLS) fortsätter fungera som tidigare.
 */
export const openApp = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env["APP_OWNER_EMAIL"];
  if (!email) throw new Error("Appen är inte konfigurerad.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !link?.properties?.hashed_token) {
    throw new Error("Kunde inte öppna appen. Försök igen.");
  }

  return { ok: true as const, tokenHash: link.properties.hashed_token, email };
});
