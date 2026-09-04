import { useState } from "react";
import { Check, ChevronDown, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Props = {
  ingestUrl: string | null;
  error?: string | null;
  lastPingAt: Date | null;
};

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
      </div>
    </li>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function relative(date: Date) {
  const min = Math.round((Date.now() - date.getTime()) / 60000);
  if (min < 1) return "just nu";
  if (min < 60) return `för ${min} min sedan`;
  const h = Math.round(min / 60);
  if (h < 24) return `för ${h} tim sedan`;
  return `för ${Math.round(h / 24)} dygn sedan`;
}

export function OwnTracksGuide({ ingestUrl, error, lastPingAt }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Koppla OwnTracks (rekommenderas)
      </h3>

      <ol className="mt-3 space-y-3">
        <Step n={1} title="Installera OwnTracks">
          Gratis i App Store. Öppna appen och tillåt notiser om den frågar.
        </Step>

        <Step n={2} title="Byt till HTTP-läge – gör detta först">
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[13px] text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p>
              OwnTracks startar i <strong>MQTT-läge</strong>. Då visas Host, Port 8883, TLS,
              DeviceID och subTopic – och URL-fältet fungerar inte. Gå till{" "}
              <strong>Inställningar → Läge (Mode)</strong> och välj <strong>HTTP</strong>. Då
              byts listan ut och <strong>URL</strong> blir det fält du ska fylla i.
            </p>
          </div>
        </Step>

        <Step n={3} title="Klistra in adressen i URL-fältet längst ner">
          {ingestUrl ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                I OwnTracks-inställningarna ligger fältet <strong>URL</strong> längst ner på
                sidan, under HTTP-läget. Klistra in hela raden – inklusive allt efter{" "}
                <code>?token=</code>.
              </p>
              <code className="mt-1.5 block break-all rounded-lg bg-muted px-3 py-2 text-xs">
                {ingestUrl}
              </code>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(ingestUrl);
                    toast.success("Adressen kopierad");
                  }}
                >
                  <Copy className="size-4" /> Kopiera adressen
                </Button>
                <span className="text-xs">Adressen är privat – dela den inte.</span>
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-destructive">
              {error ?? "Hämtar din privata adress…"}
            </p>
          )}
        </Step>

        <Step n={4} title="Stäng av Autentisering och Lösenord">
          Din token ligger redan i adressen, så inga inloggningsuppgifter behövs.
        </Step>

        <Step n={5} title="Ställ in Locator">
          <strong>Significant</strong> sparar mest batteri och räcker för att se var du är.{" "}
          <strong>Move</strong> loggar tätare men drar mer ström.
        </Step>

        <Step n={6} title="Tillåt plats “Alltid”">
          Annars slutar loggningen när skärmen låses. Skapa dina platser (Jobbet, Hemma,
          Tingsrätten …) här i LifeHub först, så får besöken rätt namn och kategori automatiskt.
        </Step>
      </ol>

      <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Så här ska inställningarna se ut
        </p>
        <ul className="mt-2 space-y-1.5">
          <ChecklistItem>
            <strong>Mode:</strong> HTTP
          </ChecklistItem>
          <ChecklistItem>
            <strong>URL:</strong> hela din privata adress ovan
          </ChecklistItem>
          <ChecklistItem>
            <strong>Autentisering:</strong> av
          </ChecklistItem>
          <ChecklistItem>
            <strong>Lösenord:</strong> av
          </ChecklistItem>
          <ChecklistItem>
            <strong>iOS-platsbehörighet:</strong> Alltid
          </ChecklistItem>
        </ul>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Om OwnTracks visar <strong>“Status inaktiv”</strong> är det inte fel – det betyder bara
          att ingen position skickats än. Gå ut och rör på dig, eller tryck på skicka-ikonen
          uppe till höger i OwnTracks.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
        <Button size="sm" variant="secondary" onClick={() => setChecked(true)}>
          <Check className="size-4" /> Fungerar det?
        </Button>
        <p className="text-xs text-muted-foreground">
          {!checked
            ? "Kolla om telefonen har skickat in någon position."
            : lastPingAt
              ? `Senaste positionen togs emot ${relative(lastPingAt)}.`
              : "Ingen position har kommit in ännu. Öppna OwnTracks och tryck på ikonen uppe till höger för att skicka manuellt."}
        </p>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Fälten DeviceID, subTopic, clientId och pubTopicBase gäller bara MQTT-läget och kan
        lämnas som de är.
      </p>

      <Collapsible className="mt-4 border-t border-border/70 pt-3">
        <CollapsibleTrigger className="group flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Alternativ: Genvägar (utan extra app)
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Genvägar → Automation → Ny personlig automation.</li>
            <li>
              Välj t.ex. <strong>Ankomst</strong> till en plats.
            </li>
            <li>
              Lägg till <strong>Hämta aktuell plats</strong>.
            </li>
            <li>
              Lägg till <strong>Hämta innehåll från URL</strong>: metod POST, JSON med fälten{" "}
              <code>lat</code> och <code>lon</code> från platsen, och adressen ovan som URL.
            </li>
            <li>Slå av ”Fråga innan körning”.</li>
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
