import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { placeAutocomplete, placeLookup } from "@/lib/maps.functions";

export type PickedPlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

/** Sökfält med platsförslag från Google medan man skriver. */
export function PlaceSearchInput({
  value,
  onChange,
  onPick,
  bias = null,
  placeholder = "Sök adress eller ställe",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (place: PickedPlace) => void;
  bias?: { lat: number; lng: number } | null;
  placeholder?: string;
  id?: string;
}) {
  const suggest = useServerFn(placeAutocomplete);
  const lookup = useServerFn(placeLookup);

  const [items, setItems] = useState<Array<{ placeId: string; text: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionRef = useRef<string>(crypto.randomUUID());
  const requestRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      setItems([]);
      return;
    }
    const id = ++requestRef.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      suggest({
        data: { input: query, bias, sessionToken: sessionRef.current },
      })
        .then((result) => {
          if (id !== requestRef.current) return;
          setItems(result);
          setOpen(true);
        })
        .catch(() => {
          if (id === requestRef.current) setItems([]);
        })
        .finally(() => {
          if (id === requestRef.current) setBusy(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, bias, suggest]);

  async function choose(placeId: string, text: string) {
    setOpen(false);
    onChange(text);
    const details = await lookup({
      data: { placeId, sessionToken: sessionRef.current },
    }).catch(() => null);
    sessionRef.current = crypto.randomUUID();
    if (details) onPick(details);
  }

  return (
    <div className="relative">
      <Input
        {...(id ? { id } : {})}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
      />
      {busy ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}

      {open && items.length > 0 ? (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {items.map((item) => (
            <li key={item.placeId}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => void choose(item.placeId, item.text)}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PlaceSearchInput;
