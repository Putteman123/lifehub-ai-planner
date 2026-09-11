import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Delete, Fingerprint, Loader2, Lock, LogIn, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import "@lovable.dev/cloud-auth-js/styles.css";

import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { claimMyData } from "@/lib/account.functions";
import { markUnlocked } from "@/lib/app-lock";
import {
  beginLoginPasskey,
  beginLoginPasskeyRegistration,
  finishLoginPasskey,
  finishLoginPasskeyRegistration,
  hasLoginPasskey,
} from "@/lib/login-passkey.functions";
import { checkPin } from "@/lib/pin.functions";
import { base64urlToBuffer, bufferToBase64url, passkeysSupported } from "@/lib/webauthn";

export const Route = createFileRoute("/auth")({
  head: () => ({


    meta: [
      { title: "Logga in – LifeHub AI" },
      { name: "description", content: "Logga in med Google och lås upp LifeHub AI med Face ID eller pinkod." },
      { property: "og:title", content: "Logga in på LifeHub AI" },
      { property: "og:description", content: "Ditt personliga konto – planering skyddad med Face ID och pinkod." },
    ],
  }),
  // Ren klientvy (inloggning/Face ID/pinkod) – ingen SSR, undviker hydreringsfel.
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
  const verifyPin = useServerFn(checkPin);
  const claim = useServerFn(claimMyData);
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
  const [session, setSession] = useState<"laddar" | "utloggad" | "inloggad">("laddar");
  const [email, setEmail] = useState<string | null>(null);
  const busy = useRef(false);

  // Steg 1: har du ett konto i den här webbläsaren?
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setSession("utloggad");
        return;
      }
      setEmail(data.user.email ?? null);
      setSession("inloggad");
      // Första inloggningen flyttar över den befintliga datan till ditt konto.
      try {
        const res = await claim({});
        if (!res.ok) {
          setMessage("Appens data ägs redan av ett annat konto.");
        }
      } catch {
        // Överföringen kan köras om vid nästa inloggning.
      }
    });
    return () => {
      active = false;
    };
  }, [claim]);

  useEffect(() => {
    if (session !== "inloggad" || !passkeysSupported()) return;
    void checkPasskey({}).then((res) => setFaceAvailable(res.registered));
  }, [checkPasskey, session]);

  const { next } = Route.useSearch();

  const goIn = useCallback(async () => {
    markUnlocked();
    if (next) {
      window.location.href = next;
      return;
    }
    await navigate({ to: "/dashboard", replace: true });
  }, [navigate, next]);

  const signInWithGoogle = useCallback(async () => {
    setStatus("checking");
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMessage("Inloggningen misslyckades – försök igen.");
      setStatus("idle");
      return;
    }
    if (result.redirected) return;
    window.location.reload();
  }, []);

  const signInWithLovable = useCallback(async () => {
    setStatus("checking");
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("lovable", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMessage("Inloggningen misslyckades – försök igen.");
      setStatus("idle");
      return;
    }
    if (result.redirected) return;
    window.location.reload();
  }, []);

  const submit = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
      setStatus("checking");
      try {
        const res = await verifyPin({ data: { pin: code } });
        if (!res.ok) {
          setStatus("error");
          setPin("");
          return;
        }
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
    [verifyPin, faceAvailable, goIn],
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
      await goIn();
    } catch {
      setMessage("Face ID avbröts – använd pinkoden.");
      setStatus("idle");
    } finally {
      busy.current = false;
    }
  }, [beginLogin, finishLogin, goIn]);


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

  if (session === "laddar") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (session === "utloggad") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-xs text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">LifeHub AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {message ?? "Logga in med ditt Google-konto – all data blir din egen."}
          </p>
          <Button
            className="mt-7 h-14 w-full text-base"
            onClick={() => void signInWithGoogle()}
            disabled={status === "checking"}
          >
            {status === "checking" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <LogIn className="size-5" />
            )}
            Fortsätt med Google
          </Button>
          <button
            type="button"
            className="lovable-auth-button mt-3 w-full"
            onClick={() => void signInWithLovable()}
            disabled={status === "checking"}
          >
            Fortsätt med Lovable
          </button>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Efter inloggning räcker pinkod eller Face ID
          </p>
        </div>
      </main>
    );
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
              <Lock className="size-3.5" /> {email ?? "Ditt konto"}
            </>
          )}
        </p>

        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-muted-foreground"
          onClick={() => {
            void supabase.auth.signOut().then(() => window.location.reload());
          }}
        >
          Byt konto
        </Button>

      </div>
    </main>
  );
}
