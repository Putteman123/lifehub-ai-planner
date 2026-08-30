import {
  Baby,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
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
  { to: "/kassaskap", label: "Kassaskåp", icon: ShieldCheck, color: "text-nav-kassaskap" },
  { to: "/kalendrar", label: "Kalendrar", icon: Settings2, color: "text-nav-kalendrar" },
] as const;


/** Appens version, visas i inställningar. */
export const APP_VERSION = "2.0";
