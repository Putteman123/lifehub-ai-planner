import { Check } from "lucide-react";
import { useEffect } from "react";

/** Avslutande animation när listan blir klar. */
export function DoneOverlay({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md animate-in fade-in duration-300"
    >
      <span className="flex size-24 items-center justify-center rounded-full bg-cat-ledig/15 text-cat-ledig animate-in zoom-in-50 duration-500">
        <Check className="size-12 motion-safe:animate-in motion-safe:zoom-in-0 motion-safe:duration-700" />
      </span>
      <p className="mt-5 text-lg font-semibold animate-in fade-in slide-in-from-bottom-2 duration-500">
        {text}
      </p>
      <p className="mt-1 text-sm text-muted-foreground animate-in fade-in duration-700">
        Sparad under Påminnelser
      </p>
    </div>
  );
}
