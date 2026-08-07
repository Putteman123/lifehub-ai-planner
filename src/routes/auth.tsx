import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { openApp } from "@/lib/pin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Öppnar – LifeHub AI" },
      { name: "description", content: "LifeHub AI öppnas automatiskt." },
      { property: "og:title", content: "LifeHub AI" },
      { property: "og:description", content: "Personlig planering med AI." },
    ],
  }),
  // Ren klientvy – ingen SSR, undviker hydreringsfel.
  ssr: false,
  // `next` används av OAuth-samtycket så man kommer tillbaka dit efter öppning.
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = s["next"];
    return typeof next === "string" && next.startsWith("/") ? { next } : {};
  },
  component: OpenGate,
});

function OpenGate() {
  const navigate = useNavigate();
  const open = useServerFn(openApp);
  const { next } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const enter = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      const res = await open({});
      const { error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: res.tokenHash,
      });
      if (error) throw error;
      if (next) {
        window.location.href = next;
        return;
      }
      await navigate({ to: "/dashboard", replace: true });
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, [open, next, navigate]);

  useEffect(() => {
    void enter();
  }, [enter]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">LifeHub AI</h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {failed ? (
            <button type="button" className="underline" onClick={() => void enter()}>
              Kunde inte öppna – försök igen
            </button>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" />
              Öppnar…
            </>
          )}
        </p>
      </div>
    </main>
  );
}
