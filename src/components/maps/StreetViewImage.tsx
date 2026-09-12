import { useEffect, useState } from "react";

import { ensureOwnMapsKey, streetViewUrl } from "@/lib/maps-media";

/** Gatubild för en plats – döljs helt om Street View saknas. */
export function StreetViewImage({
  lat,
  lng,
  alt,
  className = "h-32 w-full object-cover",
}: {
  lat: number;
  lng: number;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void ensureOwnMapsKey().then(() => {
      if (!cancelled) setUrl(streetViewUrl(lat, lng));
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (!url || failed) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={className}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default StreetViewImage;
