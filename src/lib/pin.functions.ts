import { createServerFn } from "@tanstack/react-start";

/**
 * Enanvändarläge: appen låses upp med en pinkod i stället för konton.
 * Pinkoden ligger som serverhemlighet och jämförs aldrig i webbläsaren.
 */
export const unlockWithPin = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string }) => {
    const pin = String(input?.pin ?? "").trim();
    if (!/^\d{4,8}$/.test(pin)) throw new Error("Ogiltig pinkod.");
    return { pin };
  })
  .handler(async ({ data }) => {
    const expected = process.env["APP_PIN"];
    const email = process.env["APP_OWNER_EMAIL"];
    if (!expected || !email) throw new Error("Appen är inte konfigurerad för pinkod.");

    // Konstant-tidsjämförelse
    let diff = data.pin.length ^ expected.length;
    for (let i = 0; i < Math.max(data.pin.length, expected.length); i++) {
      diff |= (data.pin.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
    }
    if (diff !== 0) {
      await new Promise((r) => setTimeout(r, 400));
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (error || !link?.properties?.hashed_token) {
      throw new Error("Kunde inte låsa upp appen. Försök igen.");
    }

    return { ok: true as const, tokenHash: link.properties.hashed_token, email };
  });
