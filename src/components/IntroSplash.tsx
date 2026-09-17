import { useEffect, useRef, useState } from "react";

import introVideo from "@/assets/intro.mp4.asset.json";

const SEEN_KEY = "lifehub-intro-seen";

/** Kort introfilm som visas när appen öppnas första gången per besök. */
export function IntroSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* privat läge – visa ändå */
    }
    setVisible(true);
    const safety = setTimeout(() => close(), 9000);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    setFading(true);
    setTimeout(() => setVisible(false), 500);
  }

  if (!visible) return null;

  return (
    <div
      role="presentation"
      onClick={close}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src={introVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={close}
        onError={close}
        className="max-h-full max-w-full object-contain"
      />
      <button
        type="button"
        onClick={close}
        className="absolute bottom-10 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
      >
        Hoppa över
      </button>
    </div>
  );
}
