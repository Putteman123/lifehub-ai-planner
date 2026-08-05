import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncCalendar } from "@/lib/calendar-sync.functions";
import {
  connectGoogleCalendar,
  getGoogleStatus,
  listGoogleCalendarsFn,
} from "@/lib/google.functions";

/** Google-konton och import av Google-kalendrar. */
export function GooglePanel({ connectedExternalIds }: { connectedExternalIds: string[] }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getGoogleStatus);
  const listFn = useServerFn(listGoogleCalendarsFn);
  const connectFn = useServerFn(connectGoogleCalendar);
  const syncFn = useServerFn(syncCalendar);
  const [busy, setBusy] = useState<string | null>(null);

  const statusQ = useQuery({ queryKey: ["google", "status"], queryFn: () => statusFn() });
  const calendarsQ = useQuery({
    queryKey: ["google", "calendars"],
    queryFn: () => listFn(),
    enabled: statusQ.data?.some((s) => s.service === "calendar" && s.connected) ?? false,
    retry: false,
  });

  async function importCalendar(externalId: string, name: string) {
    setBusy(externalId);
    try {
      const { calendarId } = await connectFn({ data: { externalId, name } });
      const result = await syncFn({ data: { calendarId } });
      await qc.invalidateQueries({ queryKey: ["calendars"] });
      await qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(`${name}: ${result.imported} händelser importerade`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Importen misslyckades");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card-soft mb-4 p-5">
      <h2 className="text-sm font-semibold">Google-konto</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Kopplade tjänster som Andrea och appen använder.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(statusQ.data ?? []).map((s) => (
          <span
            key={s.service}
            className={`rounded-full px-2.5 py-1 text-[11px] ${
              s.connected
                ? "bg-[hsl(var(--cat-ledig)/0.15)] text-[hsl(var(--cat-ledig))]"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s.label} {s.connected ? "· ansluten" : "· ej ansluten"}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Dina Google-kalendrar</p>
        {calendarsQ.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Hämtar kalendrar…</p>
        ) : calendarsQ.isError ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Kunde inte hämta kalendrar från Google.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {(calendarsQ.data ?? []).map((c) => {
              const imported = connectedExternalIds.includes(c.id);
              return (
                <li
                  key={c.id}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2"
                >
                  <span className="truncate text-sm">{c.summary}</span>
                  <Button
                    size="sm"
                    variant={imported ? "ghost" : "secondary"}
                    disabled={busy === c.id}
                    onClick={() => importCalendar(c.id, c.summary)}
                  >
                    {busy === c.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : imported ? (
                      <>
                        <Check className="size-4" /> Synka
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" /> Importera
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
