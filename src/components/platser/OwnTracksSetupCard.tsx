import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Copy, Eye, EyeOff, KeyRound, Loader2, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { getIngestInfo, rotateIngestToken, setLocatorMode } from "@/lib/places.functions";

type Info = {
  url: string;
  otrcUrl: string;
  owntracksLink: string;
  locatorMode: "move" | "significant";
  configured: boolean;
};

export function OwnTracksSetupCard() {
  const load = useServerFn(getIngestInfo);
  const rotate = useServerFn(rotateIngestToken);
  const saveMode = useServerFn(setLocatorMode);

  const [info, setInfo] = useState<Info | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const apply = useCallback(async (next: Info) => {
    setInfo(next);
    try {
      setQr(await QRCode.toDataURL(next.owntracksLink, { width: 320, margin: 1 }));
    } catch {
      setQr(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await apply((await load()) as Info);
      } catch {
        toast.error("Kunde inte hämta din anslutning");
      }
    })();
  }, [apply, load]);

  async function chooseMode(mode: "move" | "significant") {
    if (!info || info.locatorMode === mode) return;
    setBusy(true);
    try {
      await apply((await saveMode({ data: { mode } })) as Info);
      toast.success(mode === "move" ? "Tätare uppdateringar valda" : "Batterisnålt läge valt");
    } catch {
      toast.error("Kunde inte spara läget");
    } finally {
      setBusy(false);
    }
  }

  async function doRotate() {
    setBusy(true);
    try {
      await apply((await rotate()) as Info);
      toast.success("Ny nyckel skapad – koppla telefonen igen");
    } catch {
      toast.error("Kunde inte skapa en ny nyckel");
    } finally {
      setBusy(false);
      setConfirmRotate(false);
    }
  }

  return (
    <section className="rounded-[18px] border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Anslut telefonen</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ett tryck ställer in allt i OwnTracks: adress, nyckel, HTTP-läge och rätt
            rapportering. Ingenting behöver klistras in.
          </p>
        </div>
      </div>

      <Button
        className="mt-3 w-full"
        disabled={!info || busy}
        onClick={() => {
          if (info) window.location.href = info.owntracksLink;
        }}
      >
        {info ? "Öppna i OwnTracks" : <Loader2 className="size-4 animate-spin" />}
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        OwnTracks frågar om den får hämta inställningarna – svara Ja.
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rapportering
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              { key: "move", title: "Move", sub: "Tätast, mer batteri" },
              { key: "significant", title: "Significant", sub: "Snålt med batteri" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={busy || !info}
              onClick={() => void chooseMode(o.key)}
              className={cn(
                "rounded-xl border p-2.5 text-left transition",
                info?.locatorMode === o.key
                  ? "border-primary bg-primary/10"
                  : "border-border/70 hover:bg-muted/50",
              )}
            >
              <p className="text-sm font-medium">{o.title}</p>
              <p className="text-[11px] text-muted-foreground">{o.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowQr((v) => !v)} disabled={!qr}>
          <QrCode className="size-4" /> {showQr ? "Dölj QR-kod" : "Visa QR-kod"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowUrl((v) => !v)} disabled={!info}>
          {showUrl ? <EyeOff className="size-4" /> : <Eye className="size-4" />} Visa adressen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={busy}
          onClick={() => setConfirmRotate(true)}
        >
          <KeyRound className="size-4" /> Byt nyckel
        </Button>
      </div>

      {showQr && qr ? (
        <div className="mt-3 flex flex-col items-center rounded-xl border border-border/70 bg-muted/40 p-3">
          <img src={qr} alt="QR-kod med LifeHubs OwnTracks-inställningar" className="size-44" />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Skanna med OwnTracks på en annan telefon.
          </p>
        </div>
      ) : null}

      {showUrl && info ? (
        <div className="mt-3">
          <code className="block break-all rounded-xl bg-muted px-3 py-2 text-[11px]">
            {info.url}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(info.url);
              toast.success("Adressen kopierad");
            }}
          >
            <Copy className="size-4" /> Kopiera adressen
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Adressen är privat – dela den inte.
          </p>
        </div>
      ) : null}

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skapa ny nyckel?</AlertDialogTitle>
            <AlertDialogDescription>
              Den gamla nyckeln slutar fungera. Tryck sedan på ”Öppna i OwnTracks” igen så kopplas
              telefonen om automatiskt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doRotate()}>Skapa ny nyckel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
