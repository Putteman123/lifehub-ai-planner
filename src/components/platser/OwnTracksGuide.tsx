import { useState } from "react";
import { Check, Copy, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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
        Reparera OwnTracks
      </h3>

      <ol className="mt-3 space-y-3">
        <Step n={1} title="Radera hela den gamla adressen">
          Den gamla adressen innehöll nyckeln två gånger och fungerar inte. Markera hela
          innehållet i OwnTracks-fältet <strong>URL</strong> och radera det.
        </Step>

        <Step n={2} title="Kontrollera att Mode är HTTP">
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[13px] text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p>
              Din bild visar redan <strong>HTTP</strong>, vilket är rätt. Fälten Host, Port och
              DeviceID kan fortfarande synas men ska inte fyllas i.
            </p>
          </div>
        </Step>

        <Step n={3} title="Kopiera den nya adressen och klistra in den exakt en gång">
          {ingestUrl ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                 Klistra in hela raden i fältet <strong>URL</strong>. Den ska ha exakt ett{" "}
                 <code>?token=</code> och sluta efter den nya nyckeln.
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

        <Step n={4} title="Kontrollera iPhone-behörigheterna">
          Inställningar → OwnTracks → Plats: <strong>Alltid</strong>, <strong>Exakt plats</strong>{" "}
          på och <strong>Bakgrundsuppdatering</strong> på. I OwnTracks ska Autentisering och
          Lösenord vara av.
        </Step>

        <Step n={5} title="Välj Locator och skicka en position">
          Välj <strong>Significant</strong> eller <strong>Move</strong>. Gå sedan till kartan och
          tryck på skicka-ikonen uppe till höger.
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
            <strong>Locator:</strong> Significant eller Move
          </ChecklistItem>
          <ChecklistItem>
            <strong>iPhone:</strong> Plats Alltid, Exakt plats och Bakgrundsuppdatering på
          </ChecklistItem>
        </ul>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Din bild visar <strong>“Status inaktiv”</strong>. Det betyder att OwnTracks inte skickar
          just nu. Efter steg 5 ska en riktig position synas i kontrollen ovan.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
        <Button size="sm" variant="secondary" onClick={() => setChecked(true)}>
          <Send className="size-4" /> Kontrollera senaste position
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
        Host, Port, DeviceID och MQTT-fälten ska lämnas som de är.
      </p>
    </div>
  );
}
