import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { GoogleMap } from "@/components/GoogleMap";
import { NavigateButton } from "@/components/maps/NavigateButton";
import { PlaceSearchInput } from "@/components/maps/PlaceSearchInput";
import { StreetViewImage } from "@/components/maps/StreetViewImage";
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
import { reverseGeocode } from "@/lib/maps.functions";

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

  const lookup = useServerFn(reverseGeocode);
  const geocodeQ = useQuery({
    queryKey: ["reverse-geocode", target?.lat ?? null, target?.lng ?? null],
    enabled: hasCoords,
    staleTime: 1000 * 60 * 60,
    queryFn: () => lookup({ data: { lat: target!.lat!, lng: target!.lng! } }),
  });

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
          <div className="space-y-2">
            <div className="overflow-hidden rounded-xl border border-border">
              <GoogleMap
                className="h-40 w-full"
                markers={[{ lat: target!.lat!, lng: target!.lng! }]}
              />
            </div>
            <StreetViewImage
              lat={target!.lat!}
              lng={target!.lng!}
              alt="Gatubild vid platsen"
            />
            <NavigateButton lat={target!.lat!} lng={target!.lng!} />
            {geocodeQ.data ? (
              <button
                type="button"
                onClick={() => {
                  setLabel(geocodeQ.data!.shortName);
                }}
                className="flex w-full items-start gap-2 rounded-xl border border-border/70 px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {geocodeQ.data.shortName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {geocodeQ.data.address} · tryck för att använda
                  </span>
                </span>
              </button>
            ) : geocodeQ.isFetching ? (
              <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Hämtar adress från Google
                Maps…
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Ingen position registrerad – du kan ändå namnge besöket.
          </p>
        )}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="visit-label">Plats</Label>
            <PlaceSearchInput
              id="visit-label"
              value={label}
              placeholder="T.ex. ICA Maxi"
              bias={hasCoords ? { lat: target!.lat!, lng: target!.lng! } : null}
              onChange={setLabel}
              onPick={(place) => setLabel(place.name)}
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
              href={`https://www.google.com/maps/search/?api=1&query=${target!.lat}%2C${target!.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-3.5" /> Öppna i Google Maps
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
