import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Face ID på låsskärmen. Appen körs i enanvändarläge, så passnycklarna
 * ligger i en tabell som bara servern kommer åt. Vid lyckad verifiering
 * skapas samma engångstoken som pinkoden ger.
 */

const USER_HANDLE = "lifehub-owner";

async function requestOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return new URL(getRequest().url).origin;
}

async function storeChallenge(purpose: string) {
  const { newChallenge } = await import("@/lib/vault-webauthn.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const challenge = newChallenge();
  await supabaseAdmin.from("app_challenges").delete().eq("purpose", purpose);
  const { error } = await supabaseAdmin.from("app_challenges").insert({ challenge, purpose });
  if (error) throw new Error(error.message);
  return challenge;
}

async function consumeChallenge(purpose: string, challenge: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_challenges")
    .select("id, challenge, expires_at")
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Utmaningen har gått ut. Försök igen.");
  await supabaseAdmin.from("app_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Utmaningen har gått ut. Försök igen.");
  }
  if (data.challenge !== challenge) throw new Error("Utmaningen stämmer inte.");
}

/** Talar om ifall någon enhet redan är registrerad för Face ID. */
export const hasLoginPasskey = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("app_passkeys")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { registered: (count ?? 0) > 0 };
});

/** Startar registrering av Face ID — kräver rätt pinkod. */
export const beginLoginPasskeyRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ pin: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env["APP_PIN"];
    const { safeEqual } = await import("@/lib/vault-webauthn.server");
    if (!expected || !safeEqual(data.pin.trim(), expected)) {
      await new Promise((r) => setTimeout(r, 500));
      return { ok: false as const };
    }
    const origin = await requestOrigin();
    const challenge = await storeChallenge("app-register");
    return {
      ok: true as const,
      challenge,
      rpId: new URL(origin).hostname,
      userHandle: USER_HANDLE,
    };
  });

const finishRegistrationSchema = z.object({
  credentialId: z.string().min(1),
  publicKey: z.string().min(1),
  clientDataJSON: z.string().min(1),
  challenge: z.string().min(1),
  label: z.string().trim().max(60).optional(),
});

/** Sparar passnyckeln efter kontroll av utmaning och ursprung. */
export const finishLoginPasskeyRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => finishRegistrationSchema.parse(input))
  .handler(async ({ data }) => {
    const { assertClientData } = await import("@/lib/vault-webauthn.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = await requestOrigin();
    await consumeChallenge("app-register", data.challenge);
    assertClientData(data.clientDataJSON, {
      type: "webauthn.create",
      challenge: data.challenge,
      origin,
    });

    const { error } = await supabaseAdmin.from("app_passkeys").upsert(
      {
        credential_id: data.credentialId,
        public_key: data.publicKey,
        label: data.label ?? "Den här enheten",
      },
      { onConflict: "credential_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Startar inloggning med Face ID. */
export const beginLoginPasskey = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_passkeys").select("credential_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return { ok: false as const };

  const origin = await requestOrigin();
  const challenge = await storeChallenge("app-login");
  return {
    ok: true as const,
    challenge,
    rpId: new URL(origin).hostname,
    credentialIds: data.map((row) => row.credential_id),
  };
});

const finishLoginSchema = z.object({
  credentialId: z.string().min(1),
  authenticatorData: z.string().min(1),
  clientDataJSON: z.string().min(1),
  signature: z.string().min(1),
  challenge: z.string().min(1),
});

/** Verifierar Face ID och returnerar en engångstoken som loggar in dig. */
export const finishLoginPasskey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => finishLoginSchema.parse(input))
  .handler(async ({ data }) => {
    const { assertClientData, verifyAssertion } = await import("@/lib/vault-webauthn.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = await requestOrigin();
    await consumeChallenge("app-login", data.challenge);
    assertClientData(data.clientDataJSON, {
      type: "webauthn.get",
      challenge: data.challenge,
      origin,
    });

    const { data: credential, error } = await supabaseAdmin
      .from("app_passkeys")
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
    if (!valid) return { ok: false as const };

    const email = process.env["APP_OWNER_EMAIL"];
    if (!email) throw new Error("Appen är inte konfigurerad.");
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      throw new Error("Kunde inte låsa upp appen. Försök igen.");
    }

    return { ok: true as const, tokenHash: link.properties.hashed_token };
  });
