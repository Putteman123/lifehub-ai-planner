import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SectionCardProps = {
  title: string;
  icon?: LucideIcon;
  /** Tailwind-textklass för lägets färg, t.ex. "text-nav-handla". */
  accent?: string;
  /** Tailwind-bakgrundsklass för ikonbrickan, t.ex. "bg-nav-handla/12". */
  tint?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  /** Hopfällbart på mobil (alltid öppet från lg). */
  collapsible?: boolean;
  className?: string;
};

function Head({
  title,
  icon: Icon,
  accent = "text-primary",
  tint = "bg-primary/10",
  count,
  action,
  chevron,
}: Omit<SectionCardProps, "children" | "collapsible" | "className"> & { chevron?: boolean }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              tint,
              accent,
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        ) : null}
        <h2 className="min-w-0 truncate text-base font-semibold tracking-tight">{title}</h2>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {count !== undefined ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              tint,
              accent,
            )}
          >
            {count}
          </span>
        ) : null}
        {action}
        {chevron ? (
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180 lg:hidden" />
        ) : null}
      </span>
    </>
  );
}

/**
 * Genomgående korthuvud med färgad ikonbricka, luft och räknare.
 * Används på alla lägen så appen känns sammanhållen.
 */
export function SectionCard({
  collapsible = false,
  className,
  children,
  ...head
}: SectionCardProps) {
  if (collapsible) {
    return (
      <details open className={cn("group card-soft p-4 sm:p-5", className)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 lg:cursor-default">
          <Head {...head} chevron />
        </summary>
        <div className="mt-4 hidden group-open:block lg:block">{children}</div>
      </details>
    );
  }

  return (
    <section className={cn("card-soft p-4 sm:p-5", className)}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Head {...head} />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
