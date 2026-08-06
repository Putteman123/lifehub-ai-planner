import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Låser upp kassaskåpet med sexsiffrig pinkod. Koden jämförs bara på servern. */
export const unlockVaultWithPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env["VAULT_PIN"];
    if (!expected) throw new Error("Kassaskåpet är inte konfigurerat.");
    const { safeEqual } = await import("@/lib/vault-webauthn.server");
    if (!safeEqual(data.pin.trim(), expected)) {
      await new Promise((r) => setTimeout(r, 500));
      return { ok: false as const };
    }
    return { ok: true as const };
  });

async function requestOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return new URL(getRequest().url).origin;
}

async function storeChallenge(userId: string, purpose: string) {
  const { newChallenge } = await import("@/lib/vault-webauthn.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const challenge = newChallenge();
  await supabaseAdmin
    .from("vault_challenges")
    .delete()
    .eq("user_id", userId)
    .eq("purpose", purpose);
  const { error } = await supabaseAdmin
    .from("vault_challenges")
    .insert({ user_id: userId, challenge, purpose });
  if (error) throw new Error(error.message);
  return challenge;
}

async function consumeChallenge(userId: string, purpose: string, challenge: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("vault_challenges")
    .select("id, challenge, expires_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Utmaningen har gått ut. Försök igen.");
  await supabaseAdmin.from("vault_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Utmaningen har gått ut. Försök igen.");
  }
  if (data.challenge !== challenge) throw new Error("Utmaningen stämmer inte.");
}

/** Startar registrering av Face ID — kräver rätt pinkod. */
export const beginPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const expected = process.env["VAULT_PIN"];
    const { safeEqual } = await import("@/lib/vault-webauthn.server");
    if (!expected || !safeEqual(data.pin.trim(), expected)) {
      await new Promise((r) => setTimeout(r, 500));
      return { ok: false as const };
    }
    const origin = await requestOrigin();
    const challenge = await storeChallenge(context.userId, "register");
    return {
      ok: true as const,
      challenge,
      rpId: new URL(origin).hostname,
      userId: context.userId,
    };
  });

const finishRegistrationSchema = z.object({
  credentialId: z.string().min(1),
  publicKey: z.string().min(1),
  clientDataJSON: z.string().min(1),
  challenge: z.string().min(1),
  label: z.string().trim().max(60).optional(),
});

/** Sparar den registrerade passnyckeln efter kontroll av utmaning och ursprung. */
export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finishRegistrationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertClientData } = await import("@/lib/vault-webauthn.server");
    const origin = await requestOrigin();
    await consumeChallenge(context.userId, "register", data.challenge);
    assertClientData(data.clientDataJSON, {
      type: "webauthn.create",
      challenge: data.challenge,
      origin,
    });

    const { error } = await context.supabase.from("vault_credentials").insert({
      user_id: context.userId,
      credential_id: data.credentialId,
      public_key: data.publicKey,
      rp_id: new URL(origin).hostname,
      label: data.label ?? "Den här enheten",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Startar upplåsning med Face ID (bara nycklar för den här domänen). */
export const beginPasskeyUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const origin = await requestOrigin();
    const host = new URL(origin).hostname;
    const { data, error } = await context.supabase
      .from("vault_credentials")
      .select("credential_id")
      .eq("rp_id", host);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return { ok: false as const, reason: "none" as const };

    const challenge = await storeChallenge(context.userId, "unlock");
    return {
      ok: true as const,
      challenge,
      rpId: host,
      credentialIds: data.map((row) => row.credential_id),
    };
  });

const finishUnlockSchema = z.object({
  credentialId: z.string().min(1),
  authenticatorData: z.string().min(1),
  clientDataJSON: z.string().min(1),
  signature: z.string().min(1),
  challenge: z.string().min(1),
});

/** Verifierar Face ID-signaturen och låser upp kassaskåpet. */
export const finishPasskeyUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finishUnlockSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertClientData, verifyAssertion } = await import("@/lib/vault-webauthn.server");
    const origin = await requestOrigin();
    await consumeChallenge(context.userId, "unlock", data.challenge);
    assertClientData(data.clientDataJSON, {
      type: "webauthn.get",
      challenge: data.challenge,
      origin,
    });

    const { data: credential, error } = await context.supabase
      .from("vault_credentials")
      .select("id, public_key")
      .eq("credential_id", data.credentialId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!credential) return { ok: false as const };

    const valid = await verifyAssertion({
      publicKeySpki: credential.public_key,
      authenticatorData: data.authenticatorData,
      clientDataJSON: data.clientDataJSON,
      signature: data.signature,
    });
    return { ok: valid };
  });

/** Talar om ifall Face ID redan är registrerat för den här domänen. */
export const hasPasskey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const host = new URL(await requestOrigin()).hostname;
    const { count, error } = await context.supabase
      .from("vault_credentials")
      .select("id", { count: "exact", head: true })
      .eq("rp_id", host);
    if (error) throw new Error(error.message);
    return { registered: (count ?? 0) > 0 };
  });
