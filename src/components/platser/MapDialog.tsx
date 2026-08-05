import { ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MapTarget = {
  title: string;
  subtitle?: string;
  lat: number | null;
  lng: number | null;
};

function bbox(lat: number, lng: number, span = 0.006) {
  return [lng - span, lat - span / 2, lng + span, lat + span / 2].join("%2C");
}

export function MapDialog({
  target,
  onOpenChange,
}: {
  target: MapTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const hasCoords =
    target != null && typeof target.lat === "number" && typeof target.lng === "number";

  return (
    <Dialog open={target != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{target?.title ?? "Plats"}</DialogTitle>
        </DialogHeader>
        {target?.subtitle ? (
          <p className="-mt-2 text-xs text-muted-foreground">{target.subtitle}</p>
        ) : null}

        {hasCoords ? (
          <>
            <div className="overflow-hidden rounded-xl border border-border">
              <iframe
                title={`Karta över ${target!.title}`}
                className="h-64 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox(
                  target!.lat!,
                  target!.lng!,
                )}&layer=mapnik&marker=${target!.lat}%2C${target!.lng}`}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {target!.lat!.toFixed(5)}, {target!.lng!.toFixed(5)}
              </span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${target!.lat}&mlon=${target!.lng}#map=16/${target!.lat}/${target!.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ExternalLink className="size-3.5" /> Öppna i kartor
              </a>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ingen position registrerad för det här besöket.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
