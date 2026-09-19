import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Navigation,
  XCircle,
} from "lucide-react";

/** Enhetlig statusbricka för besök och insatser i vårddelen. */
export function CareStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: ReactNode }> = {
    planerad: {
      label: "Planerat",
      className: "bg-secondary text-secondary-foreground",
      icon: <CalendarClock className="size-3.5" />,
    },
    pagar: {
      label: "Pågår",
      className: "bg-primary/15 text-primary",
      icon: <CircleDot className="size-3.5" />,
    },
    utfort: {
      label: "Utfört",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="size-3.5" />,
    },
    uteblivet: {
      label: "Uteblivet",
      className: "bg-destructive/15 text-destructive",
      icon: <XCircle className="size-3.5" />,
    },
    avvikelse: {
      label: "Avvikelse",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      icon: <AlertTriangle className="size-3.5" />,
    },
  };
  const item = map[status] ?? map["planerad"]!;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${item.className}`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

/** Sidhuvud med ikon, rubrik och valfri bild – ger vårddelen ett kliniskt uttryck. */
export function CareSectionHeader({
  icon,
  title,
  subtitle,
  image,
  imageAlt = "",
  imageClassName = "",
  imageHeightClassName = "h-28 sm:h-36",
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  image?: string | undefined;
  imageAlt?: string;
  imageClassName?: string;
  imageHeightClassName?: string;
  action?: ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      {image ? (
        <div className={`relative w-full ${imageHeightClassName}`}>
          <img
            src={image}
            alt={imageAlt}
            className={`size-full object-cover ${imageClassName}`}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

/** Initialer som enkel, integritetsvänlig porträttbild. */
export function CareAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary ${className}`}
    >
      {initials || "–"}
    </span>
  );
}

/** Bygger en Google Maps-navigering från koordinater eller adress. */
export function careNavigationUrl(opts: {
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  address?: string | null | undefined;
}) {
  const target =
    opts.lat != null && opts.lng != null
      ? `${opts.lat},${opts.lng}`
      : (opts.address ?? "").trim();
  if (!target) return null;
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(target)}`;
}

/** Knapp som öppnar Google Maps-navigering till en brukare. */
export function CareNavigateButton({
  lat,
  lng,
  address,
  label = "Navigera",
  size = "sm",
}: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  label?: string;
  size?: "sm" | "xs";
}) {
  const url = careNavigationUrl({ lat, lng, address });
  if (!url) return null;
  const pad = size === "xs" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 ${pad}`}
    >
      <Navigation className="size-4" /> {label}
    </a>
  );
}
