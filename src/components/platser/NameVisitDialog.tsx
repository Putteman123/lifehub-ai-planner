import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLACE_KINDS, type PlaceKind } from "@/lib/geo";

export type NameVisitTarget = {
  visitId: string;
  subtitle?: string;
  lat: number | null;
  lng: number | null;
  label: string | null;
  note: string | null;
};

const DEFAULT_ACTIVITIES = [
  "Handlar",
  "Skola Philip",
  "Skola Benjamin",
  "Träning",
  "Jobb",
  "Jurist",
  "Hem",
];

function bbox(lat: number, lng: number, span = 0.006) {
  return [lng - span, lat - span / 2, lng + span, lat + span / 2].join("%2C");
}

export function NameVisitDialog({
  target,
  suggestions = [],
  saving = false,
  onOpenChange,
  onSave,
}: {
  target: NameVisitTarget | null;
  suggestions?: string[];
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    visitId: string;
    label: string;
    note: string;
    kind: PlaceKind;
    saveAsPlace: boolean;
  }) => void;
}) {
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<PlaceKind>("annat");
  const [saveAsPlace, setSaveAsPlace] = useState(true);

  const hasCoords =
    target != null && typeof target.lat === "number" && typeof target.lng === "number";

  useEffect(() => {
    if (!target) return;
    setLabel(target.label && target.label !== "Okänd plats" ? target.label : "");
    setNote(target.note ?? "");
    setKind("annat");
    setSaveAsPlace(
      typeof target.lat === "number" && typeof target.lng === "number",
    );
  }, [target]);

  const activities = Array.from(new Set([...suggestions, ...DEFAULT_ACTIVITIES])).slice(0, 10);
  const canSave = label.trim().length > 0 || note.trim().length > 0;

  return (
    <Dialog open={target != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vad är det här för plats?</DialogTitle>
        </DialogHeader>
        {target?.subtitle ? (
          <p className="-mt-2 text-xs text-muted-foreground">{target.subtitle}</p>
        ) : null}

        {hasCoords ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              title="Karta över besöket"
              className="h-36 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox(
                target!.lat!,
                target!.lng!,
              )}&layer=mapnik&marker=${target!.lat}%2C${target!.lng}`}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Ingen position registrerad – du kan ändå namnge besöket.
          </p>
        )}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="visit-label">Plats</Label>
            <Input
              id="visit-label"
              value={label}
              maxLength={80}
              placeholder="T.ex. ICA Maxi"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="visit-note">Vad gör du här?</Label>
            <Input
              id="visit-note"
              value={note}
              maxLength={120}
              placeholder="T.ex. Handlar"
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activities.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  onClick={() => {
                    setNote(a);
                    if (!label.trim()) setLabel(a);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Typ av plats</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as PlaceKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACE_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasCoords ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Spara som fast plats</p>
                <p className="text-xs text-muted-foreground">
                  Kopplar tidigare och framtida besök här automatiskt.
                </p>
              </div>
              <Switch checked={saveAsPlace} onCheckedChange={setSaveAsPlace} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {hasCoords ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${target!.lat}&mlon=${target!.lng}#map=16/${target!.lat}/${target!.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-3.5" /> Öppna i kartor
            </a>
          ) : (
            <span />
          )}
          <Button
            disabled={!canSave || saving}
            onClick={() =>
              target &&
              onSave({
                visitId: target.visitId,
                label: label.trim() || note.trim(),
                note: note.trim(),
                kind,
                saveAsPlace: hasCoords && saveAsPlace,
              })
            }
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MapPin className="size-4" />
            )}
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
