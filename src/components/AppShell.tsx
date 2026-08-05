import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Andrea } from "@/components/andrea/Andrea";
import { FloatingNav } from "@/components/FloatingNav";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function lockApp() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Bakgrundslist bakom iPhones statusfält så inget krockar med klockan. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 bg-background/85 backdrop-blur"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <FloatingNav onLock={lockApp} />

      <div className="pl-[4.25rem] sm:pl-[5rem]">
        <header
          className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        </header>

        <main
          className="px-3 pt-4 sm:px-5"
          style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </main>
      </div>

      <Andrea />
    </div>
  );
}
