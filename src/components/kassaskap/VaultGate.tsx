import { useServerFn } from "@tanstack/react-start";
import { Delete, Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { VaultAnimation, type VaultState } from "@/components/kassaskap/VaultAnimation";
import { Button } from "@/components/ui/button";
import {
  beginPasskeyUnlock,
  finishPasskeyUnlock,
  hasPasskey,
  unlockVaultWithPin,
} from "@/lib/vault.functions";
import { base64urlToBuffer, bufferToBase64url, passkeysSupported } from "@/lib/webauthn";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "faceid", "0", "del"] as const;
const PIN_LENGTH = 6;

export function VaultGate({ onUnlock }: { onUnlock: (pin: string | null) => void }) {
  const unlockPin = useServerFn(unlockVaultWithPin);
  const beginUnlock = useServerFn(beginPasskeyUnlock);
  const finishUnlock = useServerFn(finishPasskeyUnlock);
  const checkPasskey = useServerFn(hasPasskey);

  const [pin, setPin] = useState("");
  const [state, setState] = useState<VaultState>("stangd");
  const [busy, setBusy] = useState(false);
  const [faceAvailable, setFaceAvailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const guard = useRef(false);

  useEffect(() => {
    if (!passkeysSupported()) return;
    void checkPasskey({}).then((r) => setFaceAvailable(r.registered));
  }, [checkPasskey]);

  const succeed = useCallback(
    (usedPin: string | null) => {
      setState("oppnar");
      window.setTimeout(() => {
        setState("oppen");
        onUnlock(usedPin);
      }, 950);
    },
    [onUnlock],
  );

  const fail = useCallback((text: string) => {
    setState("fel");
    setMessage(text);
    setPin("");
    window.setTimeout(() => setState("stangd"), 600);
  }, []);

  const submitPin = useCallback(
    async (code: string) => {
      if (guard.current) return;
      guard.current = true;
      setBusy(true);
      try {
        const res = await unlockPin({ data: { pin: code } });
        if (res.ok) succeed(code);
        else fail("Fel pinkod – försök igen");
      } catch {
        fail("Något gick fel. Försök igen.");
      } finally {
        setBusy(false);
        guard.current = false;
      }
    },
    [unlockPin, succeed, fail],
  );

  const unlockWithFace = useCallback(async () => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const begin = await beginUnlock({});
      if (!begin.ok) {
        fail("Face ID är inte aktiverat än. Lås upp med pinkod först.");
        return;
      }
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(begin.challenge),
          rpId: begin.rpId,
          userVerification: "required",
          timeout: 60000,
          allowCredentials: begin.credentialIds.map((id) => ({
            type: "public-key" as const,
            id: base64urlToBuffer(id),
          })),
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        fail("Face ID avbröts.");
        return;
      }
      const response = credential.response as AuthenticatorAssertionResponse;
      const res = await finishUnlock({
        data: {
          credentialId: bufferToBase64url(credential.rawId),
          authenticatorData: bufferToBase64url(response.authenticatorData),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          signature: bufferToBase64url(response.signature),
          challenge: begin.challenge,
        },
      });
      if (res.ok) succeed(null);
      else fail("Face ID kunde inte verifieras.");
    } catch {
      fail("Face ID avbröts.");
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }, [beginUnlock, finishUnlock, succeed, fail]);

  function press(key: string) {
    if (busy) return;
    setMessage(null);
    if (key === "faceid") {
      void unlockWithFace();
      return;
    }
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin.length >= PIN_LENGTH ? pin : pin + key).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) void submitPin(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center py-4 text-center">
      <VaultAnimation state={state} size={196} />

      <h2 className="mt-5 flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="size-4" /> Kassaskåpet är låst
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {message ?? (faceAvailable ? "Face ID eller sexsiffrig pinkod" : "Ange din sexsiffriga pinkod")}
      </p>

      <div className="mt-5 flex items-center justify-center gap-2.5" aria-label="Pinkod">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`size-3 rounded-full transition-colors ${
              state === "fel"
                ? "bg-destructive/50"
                : i < pin.length
                  ? "bg-primary"
                  : "bg-muted-foreground/25"
            }`}
          />
        ))}
      </div>

      <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
        {KEYS.map((key) =>
          key === "faceid" && !faceAvailable ? (
            <span key={key} />
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={busy}
              aria-label={key === "del" ? "Radera" : key === "faceid" ? "Lås upp med Face ID" : key}
              className="flex h-14 items-center justify-center rounded-2xl border border-border bg-card text-lg font-medium transition-colors hover:bg-muted active:bg-muted disabled:opacity-50"
            >
              {key === "del" ? (
                <Delete className="size-5" />
              ) : key === "faceid" ? (
                <Fingerprint className="size-5 text-primary" />
              ) : (
                key
              )}
            </button>
          ),
        )}
      </div>

      {faceAvailable ? (
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void unlockWithFace()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
          Lås upp med Face ID
        </Button>
      ) : null}
    </div>
  );
}
