import { useMemo } from "react";
import { CalendarRange } from "lucide-react";

import type { Tables } from "@/integrations/supabase/types";
import type { EventRow } from "@/lib/categories";
import { useSpends } from "@/lib/finance";

type ChildRow = Tables<"children">;

const WEEKDAYS = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";

function mondayOf(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

/**
 * Per barn: veckoschema (mån–sön), antal timmar aktiviteter och
 * kostnader som knutits till barnet via anteckning på utgiften.
 */
export function ChildWeekCards({
  children,
  events,
}: {
  children: ChildRow[];
  events: EventRow[];
}) {
  const spendsQ = useSpends();
  const start = useMemo(() => mondayOf(new Date()), []);
  const end = useMemo(() => new Date(start.getTime() + 7 * 86_400_000), [start]);

  const perChild = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return children.map((child) => {
      const own = events.filter((e) => {
        if (e.child_id !== child.id) return false;
        const t = new Date(e.starts_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      });

      const perDay = WEEKDAYS.map((_, i) => {
        const day = new Date(start.getTime() + i * 86_400_000);
        return own.filter((e) => {
          const d = new Date(e.starts_at);
          return d.toDateString() === day.toDateString();
        }).length;
      });

      const hours = own.reduce((sum, e) => {
        if (e.all_day) return sum + 8;
        const ms = new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime();
        return sum + Math.max(0, ms) / 3_600_000;
      }, 0);

      const needle = child.name.toLowerCase();
      const cost = (spendsQ.data ?? [])
        .filter(
          (s) =>
            new Date(s.spent_at).getTime() >= monthStart.getTime() &&
            (s.note ?? "").toLowerCase().includes(needle),
        )
        .reduce((sum, s) => sum + Number(s.amount), 0);

      const next = own
        .slice()
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .find((e) => new Date(e.starts_at).getTime() >= Date.now());

      return { child, perDay, hours, cost, count: own.length, next };
    });
  }, [children, events, spendsQ.data, start, end]);

  if (children.length === 0) return null;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {perChild.map(({ child, perDay, hours, cost, count, next }) => (
        <section key={child.id} className="card-soft p-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: child.color }}
              aria-hidden
            />
            <h3 className="text-sm font-semibold">{child.name}</h3>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarRange className="size-3.5" /> denna vecka
            </span>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((label, i) => (
              <div key={label} className="text-center">
                <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                <div
                  className={`mt-1 flex h-9 items-center justify-center rounded-lg text-xs font-medium ${
                    perDay[i] ? "bg-cat-barn/25 text-foreground" : "bg-surface text-muted-foreground"
                  }`}
                >
                  {perDay[i] || "–"}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="text-foreground">{count}</span> aktiviteter
            </span>
            <span>
              <span className="text-foreground">{Math.round(hours)}</span> timmar
            </span>
            <span>
              Kostnad i månaden: <span className="text-foreground">{kr(cost)}</span>
            </span>
          </div>

          {next ? (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              Nästa: <span className="text-foreground">{next.title}</span>{" "}
              {new Date(next.starts_at).toLocaleString("sv-SE", {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
