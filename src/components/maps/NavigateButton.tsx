import { Navigation } from "lucide-react";

import { navigationUrl, wazeUrl } from "@/lib/maps-media";

/** Startar navigering till en plats i Google Maps (och Waze som alternativ). */
export function NavigateButton({
  lat,
  lng,
  label = "Navigera hit",
  withWaze = true,
}: {
  lat: number;
  lng: number;
  label?: string;
  withWaze?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={navigationUrl({ lat, lng })}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Navigation className="size-3.5" /> {label}
      </a>
      {withWaze ? (
        <a
          href={wazeUrl({ lat, lng })}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Waze
        </a>
      ) : null}
    </div>
  );
}

export default NavigateButton;
