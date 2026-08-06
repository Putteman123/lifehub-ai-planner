import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDeleteRow, useUpsertRow } from "@/lib/db";
import { PLACE_KINDS, type PlaceKind, type PlaceRow, type VisitRow } from "@/lib/geo";
import { nameVisit } from "@/lib/places.functions";

/** ISO -> värde för <input type="datetime-local"> i lokal tid. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

const FREE = "__fritext__";

/** Redigera ett registrerat besök: plats, aktivitet, tider och typ. */
export function EditVisitDialog({
  visit,
  places,
  onClose,
}: {
  visit: VisitRow | null;
  places: PlaceRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useUpsertRow("visits", "Besöket uppdaterat");
  const remove = useDeleteRow("visits", "Besöket borttaget");
  const saveName = useServerFn(nameVisit);

  const [placeId, setPlaceId] = useState<string>(FREE);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [arrived, setArrived] = useState("");
  const [left, setLeft] = useState("");
  const [kind, setKind] = useState<PlaceKind>("annat");
  const [asTravel, setAsTravel] = useState(false);
  const [saveAsPlace, setSaveAsPlace] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visit) return;
    setPlaceId(visit.place_id ?? FREE);
    setLabel(visit.label ?? "");
    setNote(visit.note ?? "");
    setArrived(toLocalInput(visit.arrived_at));
    setLeft(toLocalInput(visit.left_at));
    setKind(places.find((p) => p.id === visit.place_id)?.kind ?? "annat");
    setAsTravel(visit.entry_kind === "resa");
    setSaveAsPlace(false);
  }, [visit, places]);

  if (!visit) return null;

  const hasCoords = visit.lat != null && visit.lng != null;
  const selected = places.find((p) => p.id === placeId) ?? null;

  const save = async () => {
    setBusy(true);
    try {
      const nextArrived = fromLocalInput(arrived) ?? visit.arrived_at;
      const nextLeft = fromLocalInput(left);
      if (nextLeft && new Date(nextLeft) < new Date(nextArrived)) {
        toast.error("Avfärd kan inte vara före ankomst.");
        setBusy(false);
        return;
      }

      await upsert.mutateAsync({
        id: visit.id,
        arrived_at: nextArrived,
        left_at: nextLeft,
        label: (selected ? selected.name : label.trim()) || null,
        note: note.trim() || null,
        place_id: selected ? selected.id : null,
        entry_kind: asTravel ? "resa" : "besok",
        lat: visit.lat,
        lng: visit.lng,
        is_manual: true,
      });

      if (saveAsPlace && hasCoords && !selected && label.trim()) {
        const res = await saveName({
          data: {
            visitId: visit.id,
            label: label.trim(),
            note: note.trim(),
            kind,
            saveAsPlace: true,
          },
        });
        await qc.invalidateQueries({ queryKey: ["places"] });
        if (res.linked > 1) toast.success(`${res.linked} besök kopplades till platsen`);
      }
      await qc.invalidateQueries({ queryKey: ["visits"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte spara besöket.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redigera besök</DialogTitle>
          <DialogDescription>Ändra plats, aktivitet och tider.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Plats</Label>
            <Select value={placeId} onValueChange={setPlaceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FREE}>Eget namn…</SelectItem>
                {places.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selected ? (
            <div className="grid gap-1.5">
              <Label htmlFor="visit-edit-label">Namn</Label>
              <Input
                id="visit-edit-label"
                value={label}
                maxLength={80}
                placeholder="T.ex. ICA Maxi"
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="visit-edit-note">Aktivitet</Label>
            <Input
              id="visit-edit-note"
              value={note}
              maxLength={120}
              placeholder="T.ex. Handlar"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="visit-edit-arrived">Ankomst</Label>
              <Input
                id="visit-edit-arrived"
                type="datetime-local"
                value={arrived}
                onChange={(e) => setArrived(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="visit-edit-left">Avfärd</Label>
              <Input
                id="visit-edit-left"
                type="datetime-local"
                value={left}
                onChange={(e) => setLeft(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Det här är en resa</p>
              <p className="text-xs text-muted-foreground">
                Resor får sträcka och färdsätt i reseloggen.
              </p>
            </div>
            <Switch checked={asTravel} onCheckedChange={setAsTravel} />
          </div>

          {hasCoords && !selected ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Spara som fast plats</p>
                  <p className="text-xs text-muted-foreground">
                    Kopplar tidigare och framtida besök här automatiskt.
                  </p>
                </div>
                <Switch checked={saveAsPlace} onCheckedChange={setSaveAsPlace} />
              </div>
              {saveAsPlace ? (
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
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (confirm("Ta bort det här besöket?")) {
                remove.mutate(visit.id);
                onClose();
              }
            }}
          >
            <Trash2 className="size-4" /> Radera
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Spara
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
