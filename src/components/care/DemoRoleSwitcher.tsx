import { Eye } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";

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
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { slug?: string };

  const changeRole = (next: DemoRole) => {
    setRole(next);
    if (!params.slug) return;
    const to = next === "admin" ? "/v/f/$slug" : next === "staff" ? "/v/f/$slug/brukare" : "/v/f/$slug/schema";
    void navigate({ to, params: { slug: params.slug } });
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-1.5">
      <Eye className="size-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Visa som</span>
      <Select value={role} onValueChange={(v) => changeRole(v as DemoRole)}>
        <SelectTrigger className="h-7 w-[168px] rounded border-0 bg-secondary text-sm">
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
