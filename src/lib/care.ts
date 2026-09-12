/** Roller och moduler för LifeHub Vård. */

export type CareRole = "superadmin" | "org_admin" | "caregiver" | "client" | "relative";

export const ROLE_LABELS: Record<CareRole, string> = {
  superadmin: "Superadmin",
  org_admin: "Verksamhetsadmin",
  caregiver: "Vårdpersonal",
  client: "Brukare",
  relative: "Anhörig",
};

export const ROLE_DESCRIPTIONS: Record<CareRole, string> = {
  superadmin: "Skapar organisationer och bestämmer vilka moduler de får.",
  org_admin: "Lägger in schema, personal och brukare i sin verksamhet.",
  caregiver: "Ser dagens schema, uppgifter, karta och medicin.",
  client: "Ser sin dag, sina besök och sina mediciner.",
  relative: "Följer sin närstående – endast med samtycke.",
};

export const CARE_MODULES = [
  { key: "schema", label: "Schema", hint: "Besök med adress, uppgifter och beräknad tid" },
  { key: "medicin", label: "Medicin", hint: "Medicinlista som prickas av vid utdelning" },
  { key: "karta", label: "Karta och rutt", hint: "Bästa väg efter dagens färdsätt" },
  { key: "uppgifter", label: "Uppgifter", hint: "Checklista per besök" },
  { key: "handla", label: "Handla", hint: "Inköpslista och skafferi" },
  { key: "ekonomi", label: "Ekonomi", hint: "Endast brukare och anhörig med samtycke" },
  { key: "andrea", label: "Andrea (AI)", hint: "Trygg assistent med begränsade befogenheter" },
] as const;

export type CareModule = (typeof CARE_MODULES)[number]["key"];

/** Vilka moduler en roll över huvud taget får se, oavsett organisationens val. */
export const ROLE_MODULES: Record<CareRole, CareModule[]> = {
  superadmin: ["schema", "medicin", "karta", "uppgifter", "handla", "ekonomi", "andrea"],
  org_admin: ["schema", "medicin", "karta", "uppgifter", "handla"],
  caregiver: ["schema", "medicin", "karta", "uppgifter", "handla"],
  client: ["schema", "medicin", "handla", "andrea"],
  relative: ["schema", "medicin", "handla", "ekonomi"],
};

export function moduleLabel(key: string): string {
  return CARE_MODULES.find((m) => m.key === key)?.label ?? key;
}

/** Modulerna som faktiskt ska visas för en person i en organisation. */
export function visibleModules(role: CareRole, orgModules: string[]): CareModule[] {
  return ROLE_MODULES[role].filter((m) => orgModules.includes(m));
}
