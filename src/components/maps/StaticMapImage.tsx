import { useEffect, useState } from "react";

import { ensureOwnMapsKey, staticMapUrl } from "@/lib/maps-media";

/** Liten kartminiatyr för listor och kort. */
export function StaticMapImage({
  lat,
  lng,
  alt,
  zoom = 15,
  className = "h-24 w-full object-cover",
}: {
  lat: number;
  lng: number;
  alt: string;
  zoom?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void ensureOwnMapsKey().then(() => {
      if (!cancelled) setUrl(staticMapUrl(lat, lng, { zoom }));
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, zoom]);

  if (!url || failed) return null;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`rounded-xl border border-border ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

export default StaticMapImage;
