import { useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { Andrea } from "@/components/andrea/Andrea";
import { FloatingNav, MobileNav } from "@/components/FloatingNav";
import { Menu } from "lucide-react";

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Bakgrundslist bakom iPhones statusfält så inget krockar med klockan. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 bg-background/85 backdrop-blur"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <FloatingNav />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />


      <div className="sm:pl-[5rem]">
        <header
          className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3 sm:px-5 sm:py-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Öppna meny"
              className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-2xl text-foreground transition-colors hover:bg-muted sm:hidden"
            >
              <Menu className="size-6" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
              {subtitle ? (
                <p className="truncate text-[13px] text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        </header>

        <main
          key={pathname}
          className="view-enter px-3 pt-4 sm:px-5"
          style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </main>
      </div>

      <Andrea />
    </div>
  );
}
