import { ExternalLink } from "lucide-react";

import { GoogleMap } from "@/components/GoogleMap";
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
              <GoogleMap
                className="h-64 w-full"
                markers={[
                  { lat: target!.lat!, lng: target!.lng!, title: target!.title },
                ]}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {target!.lat!.toFixed(5)}, {target!.lng!.toFixed(5)}
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${target!.lat}%2C${target!.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ExternalLink className="size-3.5" /> Öppna i Google Maps
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
