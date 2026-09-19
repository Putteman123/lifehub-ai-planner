import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Rollerna man kan visa systemet som i demoläget. */
export const DEMO_ROLES = [
  { value: "admin", label: "Verksamhetsadmin" },
  { value: "staff", label: "Personal" },
  { value: "client", label: "Brukare" },
  { value: "relative", label: "Anhörig" },
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number]["value"];

/** Vilka flikar varje roll ser i verksamhetsvyn. */
export const DEMO_ROLE_TABS: Record<DemoRole, readonly string[]> = {
  admin: [
    "personal",
    "brukare",
    "schema",
    "karta",
    "insatser",
    "medicin",
    "handla",
    "rapporter",
    "ekonomi",
  ],
  staff: ["brukare", "schema", "karta", "insatser", "medicin", "handla"],
  client: ["schema", "medicin", "handla"],
  relative: ["schema", "medicin", "handla"],
};

const STORAGE_KEY = "lifehub-demo-role";

const DemoRoleContext = createContext<{
  role: DemoRole;
  setRole: (role: DemoRole) => void;
}>({ role: "admin", setRole: () => {} });

export function DemoRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>("admin");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as DemoRole | null;
    if (saved && DEMO_ROLES.some((r) => r.value === saved)) setRoleState(saved);
  }, []);

  const setRole = useCallback((next: DemoRole) => {
    setRoleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>;
}

export function useDemoRole() {
  return useContext(DemoRoleContext);
}

export function demoRoleLabel(role: DemoRole) {
  return DEMO_ROLES.find((r) => r.value === role)?.label ?? "Verksamhetsadmin";
}
