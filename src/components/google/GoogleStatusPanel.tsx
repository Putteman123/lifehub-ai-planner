import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileText,
  HardDrive,
  Mail,
  MapPin,
  RefreshCw,
  Sheet,
  MinusCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getGoogleHealth } from "@/lib/google.functions";

const ICONS: Record<string, typeof Mail> = {
  calendar: CalendarDays,
  mail: Mail,
  drive: HardDrive,
  docs: FileText,
  sheets: Sheet,
  maps: MapPin,
};

function relative(iso: string | null): string {
  if (!iso) return "aldrig synkad";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just nu";
  if (min < 60) return `${min} min sedan`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} tim sedan`;
  return `${Math.round(h / 24)} dgr sedan`;
}

/** Statuspanel med koppling, svarstid, senaste synk och fel per Google-tjänst. */
export function GoogleStatusPanel() {
  const healthFn = useServerFn(getGoogleHealth);
  const q = useQuery({
    queryKey: ["google", "health"],
    queryFn: () => healthFn(),
    refetchInterval: 5 * 60 * 1000,
  });

  const data = q.data;
  const problems = (data?.services ?? []).filter((s) => s.connected && !s.ok).length;

  return (
    <section className="card-soft mb-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Google-status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {q.isFetching
              ? "Kontrollerar tjänster…"
              : data
                ? `Kontrollerad ${relative(data.checkedAt)}${problems > 0 ? ` · ${problems} fel` : ""}`
                : "Ingen statusdata"}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Kontrollera Google-tjänster"
          onClick={() => q.refetch()}
        >
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {(data?.services ?? []).map((s) => {
          const Icon = ICONS[s.service] ?? Mail;
          const state = !s.connected ? "off" : s.ok ? "ok" : "error";
          return (
            <li
              key={s.service}
              className="flex min-w-0 items-start gap-2 rounded-xl bg-muted/40 px-3 py-2"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{s.label}</span>
                  {state === "ok" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-[hsl(var(--cat-ledig))]" />
                  ) : state === "error" ? (
                    <AlertTriangle className="size-3.5 shrink-0 text-[hsl(var(--cat-viktigt))]" />
                  ) : (
                    <MinusCircle className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {state === "off"
                    ? "Ej kopplad"
                    : state === "ok"
                      ? `OK${s.latencyMs != null ? ` · ${s.latencyMs} ms` : ""}${
                          s.service === "calendar"
                            ? ` · synk ${relative(data?.lastCalendarSync ?? null)}`
                            : ""
                        }`
                      : "Fel vid kontroll"}
                </p>
                {s.error && state === "error" ? (
                  <p className="mt-1 break-words text-[11px] text-[hsl(var(--cat-viktigt))]">
                    {s.error}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
        {!data && q.isLoading ? (
          <li className="text-sm text-muted-foreground">Hämtar status…</li>
        ) : null}
      </ul>

      {data && data.calendars.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-muted-foreground">Senaste kalendersynk</p>
          <ul className="mt-1 space-y-1">
            {data.calendars.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {relative(c.lastSyncedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
