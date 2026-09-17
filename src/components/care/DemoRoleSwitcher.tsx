import { Eye } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEMO_ROLES, type DemoRole, useDemoRole } from "@/lib/demo-role";

/** Liten brytare som låter demonstratören visa systemet som en annan roll. */
export function DemoRoleSwitcher() {
  const { role, setRole } = useDemoRole();

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5">
      <Eye className="size-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Visa som</span>
      <Select value={role} onValueChange={(v) => setRole(v as DemoRole)}>
        <SelectTrigger className="h-7 w-[168px] rounded-full border-0 bg-secondary text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
