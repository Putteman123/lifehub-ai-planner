import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Delete, Fingerprint, Loader2, Lock, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  beginLoginPasskey,
  beginLoginPasskeyRegistration,
  finishLoginPasskey,
  finishLoginPasskeyRegistration,
  hasLoginPasskey,
} from "@/lib/login-passkey.functions";
import { unlockWithPin } from "@/lib/pin.functions";
import { base64urlToBuffer, bufferToBase64url, passkeysSupported } from "@/lib/webauthn";

export const Route = createFileRoute("/auth")({
  // Låsskärmen beror på localStorage/WebAuthn – rendera bara i klienten.
  ssr: false,
  head: () => ({

    meta: [
      { title: "Lås upp – LifeHub AI" },
      { name: "description", content: "Lås upp LifeHub AI med Face ID eller din pinkod." },
      { property: "og:title", content: "Lås upp LifeHub AI" },
      { property: "og:description", content: "Personlig planering skyddad med Face ID och pinkod." },
    ],
  }),
  // Ren klientvy (Face ID/pinkod) – ingen SSR, undviker hydreringsfel.
  ssr: false,
  // `next` används av OAuth-samtycket så man kommer tillbaka dit efter upplåsning.
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = s["next"];
    return typeof next === "string" && next.startsWith("/") ? { next } : {};
  },
  component: PinGate,
});

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "face", "0", "del"] as const;

function PinGate() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockWithPin);
  const checkPasskey = useServerFn(hasLoginPasskey);
  const beginRegister = useServerFn(beginLoginPasskeyRegistration);
  const finishRegister = useServerFn(finishLoginPasskeyRegistration);
  const beginLogin = useServerFn(beginLoginPasskey);
  const finishLogin = useServerFn(finishLoginPasskey);

  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [faceAvailable, setFaceAvailable] = useState(false);
  const [offerFaceId, setOfferFaceId] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!passkeysSupported()) return;
    void checkPasskey({}).then((res) => setFaceAvailable(res.registered));
  }, [checkPasskey]);

  const { next } = Route.useSearch();

  const goIn = useCallback(async () => {
    if (next) {
      window.location.href = next;
      return;
    }
    await navigate({ to: "/dashboard", replace: true });
  }, [navigate, next]);

  const signInWithTokenHash = useCallback(async (tokenHash: string) => {
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (error) throw error;
  }, []);

  const submit = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
      setStatus("checking");
      try {
        const res = await unlock({ data: { pin: code } });
        if (!res.ok) {
          setStatus("error");
          setPin("");
          return;
        }
        await signInWithTokenHash(res.tokenHash);
        if (passkeysSupported() && !faceAvailable) {
          setStatus("idle");
          setOfferFaceId(code);
          return;
        }
        await goIn();
      } catch {
        setStatus("error");
        setPin("");
      } finally {
        busy.current = false;
      }
    },
    [unlock, signInWithTokenHash, faceAvailable, goIn],
  );

  const unlockWithFace = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus("checking");
    setMessage(null);
    try {
      const begin = await beginLogin({});
      if (!begin.ok) {
        setMessage("Face ID är inte aktiverat än. Lås upp med pinkod först.");
        setStatus("idle");
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
      if (!credential) throw new Error("avbruten");

      const response = credential.response as AuthenticatorAssertionResponse;
      const res = await finishLogin({
        data: {
          credentialId: bufferToBase64url(credential.rawId),
          authenticatorData: bufferToBase64url(response.authenticatorData),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          signature: bufferToBase64url(response.signature),
          challenge: begin.challenge,
        },
      });
      if (!res.ok) {
        setMessage("Face ID kunde inte verifieras.");
        setStatus("error");
        return;
      }
      await signInWithTokenHash(res.tokenHash);
      await goIn();
    } catch {
      setMessage("Face ID avbröts – använd pinkoden.");
      setStatus("idle");
    } finally {
      busy.current = false;
    }
  }, [beginLogin, finishLogin, signInWithTokenHash, goIn]);

  const registerFace = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
      setStatus("checking");
      try {
        const begin = await beginRegister({ data: { pin: code } });
        if (!begin.ok) throw new Error("fel pin");

        const credential = (await navigator.credentials.create({
          publicKey: {
            challenge: base64urlToBuffer(begin.challenge),
            rp: { id: begin.rpId, name: "LifeHub AI" },
            user: {
              id: new TextEncoder().encode(begin.userHandle),
              name: "LifeHub AI",
              displayName: "LifeHub AI",
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
              residentKey: "preferred",
            },
            timeout: 60000,
          },
        })) as PublicKeyCredential | null;
        if (!credential) throw new Error("avbruten");

        const attestation = credential.response as AuthenticatorAttestationResponse;
        const publicKey = attestation.getPublicKey?.();
        if (!publicKey) throw new Error("stöds inte");

        await finishRegister({
          data: {
            credentialId: bufferToBase64url(credential.rawId),
            publicKey: bufferToBase64url(publicKey),
            clientDataJSON: bufferToBase64url(attestation.clientDataJSON),
            challenge: begin.challenge,
          },
        });
        setFaceAvailable(true);
      } catch {
        // Registreringen är frivillig – fortsätt in i appen ändå.
      } finally {
        busy.current = false;
        setOfferFaceId(null);
        await goIn();
      }
    },
    [beginRegister, finishRegister, goIn],
  );

  function press(key: string) {
    if (status === "checking") return;
    setStatus("idle");
    setMessage(null);
    if (key === "face") {
      void unlockWithFace();
      return;
    }
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin.length >= 4 ? pin : pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  if (offerFaceId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-xs text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Fingerprint className="size-7" />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Aktivera Face ID?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nästa gång räcker ansiktet – pinkoden finns kvar som reserv.
          </p>
          <Button
            className="mt-6 h-12 w-full"
            onClick={() => void registerFace(offerFaceId)}
            disabled={status === "checking"}
          >
            {status === "checking" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            Aktivera Face ID
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => {
              setOfferFaceId(null);
              void goIn();
            }}
          >
            Inte nu
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">LifeHub AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {message ??
            (status === "error"
              ? "Fel pinkod – försök igen"
              : faceAvailable
                ? "Face ID eller pinkod"
                : "Ange din pinkod")}
        </p>

        {faceAvailable ? (
          <Button
            className="mt-5 h-14 w-full text-base"
            onClick={() => void unlockWithFace()}
            disabled={status === "checking"}
          >
            {status === "checking" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Fingerprint className="size-5" />
            )}
            Lås upp med Face ID
          </Button>
        ) : null}

        <div className="mt-7 flex items-center justify-center gap-3" aria-label="Pinkod">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full transition-colors ${
                status === "error"
                  ? "bg-destructive/40"
                  : i < pin.length
                    ? "bg-primary"
                    : "bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === "face" && !faceAvailable ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(key)}
                disabled={status === "checking"}
                aria-label={
                  key === "del" ? "Radera" : key === "face" ? "Lås upp med Face ID" : key
                }
                className="flex h-14 items-center justify-center rounded-2xl border border-border bg-card text-lg font-medium transition-colors hover:bg-muted active:bg-muted disabled:opacity-50"
              >
                {key === "del" ? (
                  <Delete className="size-5" />
                ) : key === "face" ? (
                  <Fingerprint className="size-5 text-primary" />
                ) : (
                  key
                )}
              </button>
            ),
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {status === "checking" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Låser upp…
            </>
          ) : (
            <>
              <Lock className="size-3.5" /> Endast du har tillgång
            </>
          )}
        </p>
      </div>
    </main>
  );
}
