import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, MapPin, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { placesStatus } from "@/lib/places.functions";
import { timeLocal } from "@/lib/tz";

function agoLabel(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h sedan`;
  return `${Math.round(hours / 24)} dygn sedan`;
}

const SOURCE_LABEL: Record<string, string> = {
  telefon: "telefonen",
  app: "appen",
  live: "live-läget",
  manual: "manuellt",
};

/** Svarar direkt på "funkar loggningen?" och städar hängande besök vid laddning. */
export function PlacesStatusCard({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const status = useServerFn(placesStatus);
  const q = useQuery({
    queryKey: ["places_status"],
    queryFn: () => status({}),
    refetchInterval: 30000,
  });

  const data = q.data;
  const lastPing = data?.lastPingAt ?? null;
  const lastPhonePing = data?.lastPhonePingAt ?? null;
  const silentHours = lastPhonePing
    ? (Date.now() - new Date(lastPhonePing).getTime()) / 3600000
    : Infinity;
  const silent = silentHours > 6;

  return (
    <section className="rounded-[18px] border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="size-4 text-primary" /> Loggningens status
          </h2>
          {q.isLoading ? (
            <p className="mt-1 text-sm text-muted-foreground">Kontrollerar…</p>
          ) : lastPhonePing ? (
            <div className="mt-1 space-y-1">
              <p className="text-sm font-medium text-foreground">OwnTracks fungerar</p>
              <p className="text-sm text-muted-foreground">
                Senaste position {timeLocal(lastPhonePing)} ({agoLabel(lastPhonePing)}).
              </p>
              <p className="text-xs text-muted-foreground">
                {data?.phonePings24h ?? 0} positioner mottagna senaste dygnet.
              </p>
            </div>
          ) : lastPing ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Ingen ny position från OwnTracks. Senaste manuella position {timeLocal(lastPing)} från{" "}
              {SOURCE_LABEL[data?.lastPingSource ?? ""] ?? data?.lastPingSource ?? "okänd källa"}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Ingen position registrerad än.</p>
          )}

          {data?.openVisit ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {data.openVisit.isTravel ? "Resa" : "Besök"} pågår sedan{" "}
              {timeLocal(data.openVisit.arrivedAt)}
              {data.openVisit.label ? ` · ${data.openVisit.label}` : ""}
            </p>
          ) : null}
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            silent ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"
          }`}
        >
          {silent ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {silent ? "Inget inflöde" : "Igång"}
        </span>
      </div>

      {silent && !q.isLoading ? (
        <div className="mt-3 rounded-2xl bg-destructive/5 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-destructive">
            {lastPhonePing
              ? `Telefonen har inte skickat någon position sedan ${timeLocal(lastPhonePing)} (${agoLabel(lastPhonePing)}).`
              : "Telefonen har aldrig skickat någon position."}
          </p>
          <p className="mt-1">
            Testträffar från appen räknas inte. Senaste dygnet: {data?.phonePings24h ?? 0}{" "}
            positioner från telefonen. Gå igenom detta i tur och ordning:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              iPhone-inställningar → OwnTracks → Plats ska stå på <strong>Alltid</strong> med{" "}
              <strong>Exakt plats</strong> påslaget.
            </li>
            <li>
              OwnTracks → Inställningar → Positionsrapportering → välj <strong>Move</strong> (eller
              Significant). Står den på Manual skickas ingenting.
            </li>
            <li>
              iPhone-inställningar → OwnTracks → Bakgrundsuppdatering på, och Lågeffektläge av.
            </li>
            <li>
              Adressen från guiden ska ligga i HTTP-lägets adressfält, och fältet Hemlig
              krypteringsnyckel ska vara tomt.
            </li>
            <li>Skicka en position manuellt från kartan i OwnTracks och ladda om den här sidan.</li>
          </ol>
           {onOpenSettings ? (
             <Button className="mt-2" size="sm" variant="link" onClick={onOpenSettings}>
               Öppna guiden med adressen
             </Button>
           ) : null}
        </div>
       ) : lastPhonePing ? (
         <div className="mt-3 rounded-2xl bg-emerald-500/10 p-3 text-xs text-muted-foreground">
           <p>
             Din inställning <strong className="text-foreground">monitoring 1</strong> är aktiv och
             <strong className="text-foreground"> locatorInterval 180</strong> betyder att telefonen
             rapporterar ungefär var tredje minut. OwnTracks kan ändå visa ”inaktiv” på sin
             statussida.
           </p>
         </div>
       ) : null}

    </section>
  );
}
