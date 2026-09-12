/** Roller, moduler och behörigheter för LifeHub Vård. */

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

/** Rollerna som får rättigheter i behörighetsmatrisen. */
export const MATRIX_ROLES: CareRole[] = ["org_admin", "caregiver", "client", "relative"];

export const MATRIX_ROLE_LABELS: Record<string, string> = {
  org_admin: "Vårdföretag",
  caregiver: "Personal",
  client: "Brukare",
  relative: "Anhörig",
};

export const CARE_MODULES = [
  { key: "schema", label: "Schema", hint: "Besök med adress, uppgifter och beräknad tid" },
  { key: "uppgifter", label: "Uppgifter", hint: "Checklista per besök" },
  { key: "medicin", label: "Medicin", hint: "Medicinlista som prickas av vid utdelning" },
  { key: "karta", label: "Karta och rutt", hint: "Bästa väg efter dagens färdsätt" },
  { key: "handla", label: "Handla", hint: "Inköpslista och skafferi" },
  { key: "ekonomi", label: "Ekonomi", hint: "Endast brukare och anhörig med samtycke" },
  { key: "andrea", label: "Andrea (AI)", hint: "Trygg assistent med begränsade befogenheter" },
  { key: "personuppgifter", label: "Personuppgifter", hint: "Kontaktuppgifter och anteckningar" },
  { key: "avvikelser", label: "Avvikelser", hint: "Rapportera och följa upp händelser" },
  { key: "rapporter", label: "Rapporter", hint: "Uppföljning och statistik" },
] as const;

export type CareModule = (typeof CARE_MODULES)[number]["key"];

export const CARE_MODULE_KEYS = CARE_MODULES.map((m) => m.key) as CareModule[];

export function moduleLabel(key: string): string {
  return CARE_MODULES.find((m) => m.key === key)?.label ?? key;
}

export type PermissionCell = { can_view: boolean; can_edit: boolean };
export type PermissionMatrix = Record<string, Record<string, PermissionCell>>;

const OFF: PermissionCell = { can_view: false, can_edit: false };

/** Regler som aldrig går att klicka bort. Samma logik finns i databasen. */
export function lockedCell(role: string, module: string): PermissionCell | null {
  if (module === "ekonomi" && (role === "org_admin" || role === "caregiver")) return OFF;
  if (role === "client" && module === "personuppgifter") return { can_view: true, can_edit: false };
  return null;
}

export function lockReason(role: string, module: string): string | null {
  if (module === "ekonomi" && (role === "org_admin" || role === "caregiver"))
    return "Ekonomi är alltid stängd för vårdföretag och personal.";
  if (role === "client" && module === "personuppgifter")
    return "Brukaren ser alltid sina egna uppgifter.";
  return null;
}

export function emptyMatrix(): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const role of MATRIX_ROLES) {
    matrix[role] = {};
    for (const m of CARE_MODULE_KEYS) {
      matrix[role]![m] = lockedCell(role, m) ?? { ...OFF };
    }
  }
  return matrix;
}

function build(spec: Partial<Record<CareRole, Partial<Record<CareModule, "se" | "andra">>>>) {
  const matrix = emptyMatrix();
  for (const role of MATRIX_ROLES) {
    for (const [module, level] of Object.entries(spec[role] ?? {})) {
      const locked = lockedCell(role, module);
      matrix[role]![module] = locked ?? {
        can_view: true,
        can_edit: level === "andra",
      };
    }
  }
  return matrix;
}

export const PERMISSION_TEMPLATES: { key: string; label: string; hint: string; matrix: PermissionMatrix }[] = [
  {
    key: "standard",
    label: "Standard hemtjänst",
    hint: "Vanligast – personal jobbar i schema och uppgifter, anhörig får insyn.",
    matrix: build({
      org_admin: {
        schema: "andra",
        uppgifter: "andra",
        medicin: "andra",
        karta: "se",
        handla: "se",
        personuppgifter: "andra",
        avvikelser: "andra",
        rapporter: "se",
      },
      caregiver: {
        schema: "se",
        uppgifter: "andra",
        medicin: "andra",
        karta: "se",
        handla: "andra",
        personuppgifter: "se",
        avvikelser: "andra",
      },
      client: {
        schema: "se",
        medicin: "se",
        handla: "andra",
        andrea: "andra",
        personuppgifter: "se",
      },
      relative: { schema: "se", medicin: "se", handla: "se" },
    }),
  },
  {
    key: "minimal",
    label: "Minimal",
    hint: "Bara schema och uppgifter. Bra vid pilot.",
    matrix: build({
      org_admin: { schema: "andra", uppgifter: "andra", personuppgifter: "andra" },
      caregiver: { schema: "se", uppgifter: "andra" },
      client: { schema: "se", personuppgifter: "se" },
      relative: { schema: "se" },
    }),
  },
  {
    key: "full",
    label: "Full insyn",
    hint: "Allt påslaget, med de fasta integritetsspärrarna kvar.",
    matrix: build({
      org_admin: Object.fromEntries(CARE_MODULE_KEYS.map((m) => [m, "andra"])) as never,
      caregiver: Object.fromEntries(CARE_MODULE_KEYS.map((m) => [m, "andra"])) as never,
      client: Object.fromEntries(CARE_MODULE_KEYS.map((m) => [m, "andra"])) as never,
      relative: Object.fromEntries(CARE_MODULE_KEYS.map((m) => [m, "se"])) as never,
    }),
  },
];

/** Modulerna som faktiskt ska visas för en person i en organisation. */
export function visibleModules(
  role: CareRole,
  orgModules: string[],
  matrix?: PermissionMatrix,
): CareModule[] {
  return CARE_MODULE_KEYS.filter((m) => {
    if (!orgModules.includes(m)) return false;
    if (role === "superadmin") return true;
    const cell = matrix?.[role]?.[m];
    return cell ? cell.can_view : false;
  });
}

export const ORG_STATUS = [
  { key: "prospekt", label: "Prospekt" },
  { key: "aktiv", label: "Aktiv" },
  { key: "pausad", label: "Pausad" },
] as const;

export const ORG_CONTRACT_TYPES = [
  { key: "pilot", label: "Pilot" },
  { key: "avtal", label: "Avtal" },
] as const;

export const ORG_SEGMENTS = [
  { key: "kommun", label: "Kommun eller region" },
  { key: "privat", label: "Privat hemtjänst" },
  { key: "boende", label: "Boende" },
  { key: "annat", label: "Annat" },
] as const;
