import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/lib/nav-theme";

/** Flytande vertikal meny längs vänsterkanten – endast surfplatta och dator. */
export function FloatingNav({ onLock }: { onLock: () => void }) {
  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed left-2 top-1/2 z-40 hidden -translate-y-1/2 rounded-3xl border border-border/70 bg-background/70 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:left-3 sm:block sm:p-2"
      style={{
        paddingLeft: "max(0.375rem, env(safe-area-inset-left, 0px))",
        marginTop: "calc(env(safe-area-inset-top, 0px) / 2)",
        maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1rem)",
        overflowY: "auto",
      }}
    >
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-label={item.label}
              className="group relative flex size-11 items-center justify-center rounded-2xl transition-all duration-200 hover:bg-muted"
              activeProps={{
                className:
                  "bg-primary/10 ring-1 ring-primary/25 shadow-[var(--shadow-soft)] hover:bg-primary/10 [&_svg]:nav-pop",
              }}
            >
              <item.icon className={`size-[19px] shrink-0 ${item.color}`} />
              <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] hidden whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 md:block">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
        <li className="mt-1 border-t border-border/70 pt-1">
          <button
            type="button"
            onClick={onLock}
            aria-label="Lås appen"
            className="group relative flex size-11 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Lock className="size-[18px] shrink-0" />
            <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] hidden whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 md:block">
              Lås appen
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Utfällbar meny för mobil, öppnas från knappen i sidhuvudet. */
export function MobileNav({
  open,
  onOpenChange,
  onLock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[19rem] max-w-[85vw] p-0 sm:hidden"
      >
        <div
          className="flex h-full flex-col"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <SheetHeader className="px-5 pb-2 pt-5 text-left">
            <SheetTitle className="text-lg">LifeHub AI</SheetTitle>
          </SheetHeader>

          <nav aria-label="Huvudmeny" className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => onOpenChange(false)}
                        className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors hover:bg-muted"
                        activeProps={{
                          className: "bg-primary/10 text-primary ring-1 ring-primary/25",
                        }}
                      >
                        <item.icon className={`size-5 shrink-0 ${item.color}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          </nav>

          <div className="border-t border-border px-3 py-3">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onLock();
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Lock className="size-5 shrink-0" />
              Lås appen
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
