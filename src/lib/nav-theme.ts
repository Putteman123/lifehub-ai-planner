import {
  Archive,
  Baby,
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Scale,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Tv,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Semantisk färgtoken för lägets ikon. */
  color: string;
};

/** Ikon- och färgkarta som delas av menyn och sidhuvuden. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard, color: "text-nav-oversikt" },
  { to: "/kalender", label: "Kalender", icon: CalendarDays, color: "text-nav-kalender" },
  { to: "/attgora", label: "Att göra", icon: ListTodo, color: "text-nav-attgora" },
  { to: "/handla", label: "Handla", icon: ShoppingCart, color: "text-nav-handla" },
  { to: "/pengar", label: "Pengar", icon: Wallet, color: "text-nav-pengar" },
  { to: "/barn", label: "Barn", icon: Baby, color: "text-nav-barn" },
  { to: "/jurist", label: "Jurist", icon: Scale, color: "text-nav-jurist" },
  { to: "/iptv", label: "IPTV", icon: Tv, color: "text-nav-iptv" },
  { to: "/platser", label: "Platser", icon: MapPin, color: "text-nav-platser" },
  { to: "/arkiv", label: "Arkiv", icon: Archive, color: "text-nav-kalendrar" },
  { to: "/kassaskap", label: "Kassaskåp", icon: ShieldCheck, color: "text-nav-kassaskap" },
  { to: "/kalendrar", label: "Kalendrar", icon: Settings2, color: "text-nav-kalendrar" },
] as const;

/** Menyn grupperad så att mobilvyn blir lugnare att skumma. */
export const NAV_GROUPS: readonly { title: string; items: readonly NavItem[] }[] = [
  {
    title: "Vardag",
    items: NAV_ITEMS.filter((i) =>
      ["/dashboard", "/kalender", "/attgora", "/handla"].includes(i.to),
    ),
  },
  {
    title: "Ekonomi",
    items: NAV_ITEMS.filter((i) => ["/pengar"].includes(i.to)),
  },
  {
    title: "Familj & juridik",
    items: NAV_ITEMS.filter((i) => ["/barn", "/jurist"].includes(i.to)),
  },
  {
    title: "Verktyg",
    items: NAV_ITEMS.filter((i) =>
      ["/platser", "/iptv", "/arkiv", "/kassaskap", "/kalendrar"].includes(i.to),
    ),
  },
] as const;


/** Undermeny för vårddelen – visas under "Vård" i mobilmenyn. */
export const CARE_SUBNAV: readonly { to: string; label: string }[] = [
  { to: "/v", label: "Översikt" },
  { to: "/v/organisationer", label: "Kunder" },
  { to: "/v/samtal", label: "Samtal" },
] as const;

/** Appens version, visas i inställningar. */
export const APP_VERSION = "Alfa 1.0";

/** Systemets namn – visas i menyer och sidhuvuden. */
export const APP_NAME = "Alfa 1.0";
