import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Delete, Loader2, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { unlockWithPin } from "@/lib/pin.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lås upp – LifeHub AI" },
      { name: "description", content: "Ange din pinkod för att öppna LifeHub AI." },
      { property: "og:title", content: "Lås upp LifeHub AI" },
      { property: "og:description", content: "Personlig planering skyddad med pinkod." },
    ],
  }),
  component: PinGate,
});

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

function PinGate() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockWithPin);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");

  const submit = useCallback(
    async (code: string) => {
      setStatus("checking");
      try {
        const res = await unlock({ data: { pin: code } });
        if (!res.ok) {
          setStatus("error");
          setPin("");
          return;
        }
        const { error } = await supabase.auth.verifyOtp({
          type: "email",
          token_hash: res.tokenHash,
        });
        if (error) throw error;
        await navigate({ to: "/dashboard", replace: true });
      } catch {
        setStatus("error");
        setPin("");
      }
    },
    [unlock, navigate],
  );

  function press(key: string) {
    if (status === "checking") return;
    setStatus("idle");
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!key) return;
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + key;
      if (next.length === 4) void submit(next);
      return next;
    });
  }


  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">LifeHub AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {status === "error" ? "Fel pinkod – försök igen" : "Ange din pinkod"}
        </p>

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
            key === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(key)}
                disabled={status === "checking"}
                aria-label={key === "del" ? "Radera" : key}
                className="flex h-14 items-center justify-center rounded-2xl border border-border bg-card text-lg font-medium transition-colors hover:bg-muted active:bg-muted disabled:opacity-50"
              >
                {key === "del" ? <Delete className="size-5" /> : key}
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
