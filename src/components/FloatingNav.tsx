import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { NAV_ITEMS } from "@/lib/nav-theme";

/** Flytande vertikal meny längs vänsterkanten. */
export function FloatingNav({ onLock }: { onLock: () => void }) {
  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed left-2 top-1/2 z-40 -translate-y-1/2 rounded-3xl border border-border/70 bg-background/70 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:left-3 sm:p-2"
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
