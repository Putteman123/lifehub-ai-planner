/**
 * Serverdel för kassaskåpets Face ID-lås (WebAuthn).
 * Verifierar utmaning, ursprung och signatur — inget biometriskt lämnar enheten.
 */
import { base64urlToBytes, bufferToBase64url } from "@/lib/webauthn";

type ClientData = { type?: string; challenge?: string; origin?: string };

export function parseClientData(clientDataJSON: string): ClientData {
  const text = new TextDecoder().decode(base64urlToBytes(clientDataJSON));
  return JSON.parse(text) as ClientData;
}

export function assertClientData(
  clientDataJSON: string,
  expected: { type: string; challenge: string; origin: string },
) {
  const data = parseClientData(clientDataJSON);
  if (data.type !== expected.type) throw new Error("Ogiltig begäran.");
  if (data.challenge !== expected.challenge) throw new Error("Utmaningen stämmer inte.");
  if (data.origin !== expected.origin) throw new Error("Ogiltigt ursprung.");
}

/** DER-kodad ECDSA-signatur → rå r||s (64 byte) som WebCrypto kräver. */
function derToRaw(der: Uint8Array): Uint8Array {
  let offset = 2;
  const headerLength = der[1] ?? 0;
  if (headerLength & 0x80) offset = 2 + (headerLength & 0x7f);

  const readInteger = (): Uint8Array => {
    if (der[offset] !== 0x02) throw new Error("Ogiltig signatur.");
    offset += 1;
    const length = der[offset] ?? 0;
    offset += 1;
    const value = der.slice(offset, offset + length);
    offset += length;
    return value.length > 32 ? value.slice(value.length - 32) : value;
  };

  const r = readInteger();
  const s = readInteger();
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

export async function verifyAssertion(input: {
  publicKeySpki: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}): Promise<boolean> {
  const keyBytes = base64urlToBytes(input.publicKeySpki);
  const key = await crypto.subtle.importKey(
    "spki",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  const authData = base64urlToBytes(input.authenticatorData);
  const clientBytes = base64urlToBytes(input.clientDataJSON);
  const clientHash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      clientBytes.buffer.slice(
        clientBytes.byteOffset,
        clientBytes.byteOffset + clientBytes.byteLength,
      ) as ArrayBuffer,
    ),
  );

  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData, 0);
  signed.set(clientHash, authData.length);

  const sigBytes = base64urlToBytes(input.signature);
  const raw = sigBytes[0] === 0x30 ? derToRaw(sigBytes) : sigBytes;

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    signed.buffer.slice(signed.byteOffset, signed.byteOffset + signed.byteLength) as ArrayBuffer,
  );
}

export function newChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufferToBase64url(bytes.buffer as ArrayBuffer);
}

/** Konstant-tidsjämförelse av två korta strängar. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
