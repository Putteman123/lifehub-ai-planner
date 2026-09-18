import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { moduleLabel } from "@/lib/care";
import { StatGrid, StatLine, emptyStat, type CareStat } from "@/components/care/CareStats";
import { getAdminOrg, removeStaff, saveStaff } from "@/lib/care-admin.functions";
import { useDemoRole } from "@/lib/demo-role";

export const Route = createFileRoute("/_authenticated/v/f/$slug/")({
  head: () => ({
    meta: [
      { title: "Personal – LifeHub Vård" },
      {
        name: "description",
        content: "Verksamhetens personal, roller och arbetstider på ett ställe.",
      },
      { property: "og:title", content: "Personal – LifeHub Vård" },
      {
        property: "og:description",
        content: "Verksamhetens personal, roller och arbetstider på ett ställe.",
      },
    ],
  }),
  component: CompanyHome,
});

type Staff = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  employment: string | null;
  work_hours: string | null;
  notes: string | null;
};

const emptyStaff = {
  id: undefined as string | undefined,
  display_name: "",
  email: "",
  phone: "",
  role: "caregiver" as "caregiver" | "org_admin",
  employment: "",
  work_hours: "",
  notes: "",
};

function CompanyHome() {
  const { slug } = Route.useParams();
  const { role } = useDemoRole();
  const qc = useQueryClient();
  const fetchOrg = useServerFn(getAdminOrg);
  const persistStaff = useServerFn(saveStaff);
  const deleteStaff = useServerFn(removeStaff);

  const q = useQuery({
    queryKey: ["care-admin-org", slug],
    queryFn: () => fetchOrg({ data: { slug } }),
  });

  const [search, setSearch] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ ...emptyStaff });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["care-admin-org", slug] });

  const staffMutation = useMutation({
    mutationFn: () => persistStaff({ data: { slug, ...staffForm } }),
    onSuccess: () => {
      toast.success("Personalen är sparad.");
      setStaffOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const staffDelete = useMutation({
    mutationFn: (id: string) => deleteStaff({ data: { slug, id } }),
    onSuccess: () => {
      toast.success("Personalen är borttagen.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needle = search.trim().toLowerCase();
  const staff = useMemo(
    () =>
      ((q.data?.members ?? []) as Staff[]).filter((m) =>
        needle ? m.display_name.toLowerCase().includes(needle) : true,
      ),
    [q.data, needle],
  );

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const org = q.data!.org;
  const modules = q.data?.modules ?? [];
  const clientCount = (q.data?.clients ?? []).length;
  const stats = q.data?.stats;
  const staffStats = (stats?.staff ?? {}) as Record<string, CareStat>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {staff.length} i personalen · {clientCount} brukare
          {modules.length > 0 ? ` · ${modules.map(moduleLabel).join(", ")}` : ""}
        </p>
      </header>

      {stats ? <StatGrid stat={stats.total as CareStat} days={stats.days} /> : null}

      <Input
        placeholder="Sök personal"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Personal</h2>
          {role === "admin" ? <Button
            size="sm"
            onClick={() => {
              setStaffForm({ ...emptyStaff });
              setStaffOpen(true);
            }}
          >
            Lägg till
          </Button> : null}
        </div>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen personal upplagd ännu.</p>
        ) : (
          <ul className="space-y-2">
            {staff.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.display_name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.role === "org_admin" ? "Verksamhetsadmin" : "Personal"}
                    {m.employment ? ` · ${m.employment}` : ""}
                    {m.work_hours ? ` · ${m.work_hours}` : ""}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                  <StatLine stat={staffStats[m.id] ?? emptyStat} />
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/v/f/$slug/personal/$memberId" params={{ slug, memberId: m.id }}>
                    Öppna
                  </Link>
                </Button>
                {role === "admin" ? <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStaffForm({
                      id: m.id,
                      display_name: m.display_name,
                      email: m.email ?? "",
                      phone: m.phone ?? "",
                      role: m.role === "org_admin" ? "org_admin" : "caregiver",
                      employment: m.employment ?? "",
                      work_hours: m.work_hours ?? "",
                      notes: m.notes ?? "",
                    });
                    setStaffOpen(true);
                  }}
                >
                  Ändra
                </Button> : null}
                {role === "admin" ? <Button variant="ghost" size="sm" onClick={() => staffDelete.mutate(m.id)}>
                  Ta bort
                </Button> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{staffForm.id ? "Ändra personal" : "Ny personal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Namn">
              <Input
                value={staffForm.display_name}
                onChange={(e) => setStaffForm({ ...staffForm, display_name: e.target.value })}
              />
            </Field>
            <Field label="Roll">
              <Select
                value={staffForm.role}
                onValueChange={(v) =>
                  setStaffForm({ ...staffForm, role: v as "caregiver" | "org_admin" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caregiver">Personal</SelectItem>
                  <SelectItem value="org_admin">Verksamhetsadmin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-post">
                <Input
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                />
              </Field>
              <Field label="Telefon">
                <Input
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anställning">
                <Input
                  placeholder="Tillsvidare, timmar…"
                  value={staffForm.employment}
                  onChange={(e) => setStaffForm({ ...staffForm, employment: e.target.value })}
                />
              </Field>
              <Field label="Arbetstider">
                <Input
                  placeholder="Vardagar 07–16"
                  value={staffForm.work_hours}
                  onChange={(e) => setStaffForm({ ...staffForm, work_hours: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Anteckningar">
              <Textarea
                value={staffForm.notes}
                onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              disabled={staffForm.display_name.trim().length < 2 || staffMutation.isPending}
              onClick={() => staffMutation.mutate()}
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
