import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { getStaffDetail, saveStaff, setStaffActive } from "@/lib/care-admin.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/personal/$memberId")({
  head: () => ({
    meta: [
      { title: "Personalkort – livo.health" },
      {
        name: "description",
        content: "Kontaktuppgifter, arbetstider och besök för en anställd.",
      },
      { property: "og:title", content: "Personalkort – livo.health" },
      {
        property: "og:description",
        content: "Kontaktuppgifter, arbetstider och besök för en anställd.",
      },
    ],
  }),
  component: StaffDetail,
});

type Member = {
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

function StaffDetail() {
  const { slug, memberId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getStaffDetail);
  const persist = useServerFn(saveStaff);
  const toggleActive = useServerFn(setStaffActive);

  const q = useQuery({
    queryKey: ["care-staff", slug, memberId],
    queryFn: () => fetchDetail({ data: { slug, memberId } }),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["care-staff", slug, memberId] });

  const [form, setForm] = useState({
    display_name: "",
    email: "",
    phone: "",
    role: "caregiver" as "caregiver" | "org_admin",
    employment: "",
    work_hours: "",
    notes: "",
  });

  const member = q.data?.member as Member | undefined;

  useEffect(() => {
    if (!member) return;
    setForm({
      display_name: member.display_name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      role: member.role === "org_admin" ? "org_admin" : "caregiver",
      employment: member.employment ?? "",
      work_hours: member.work_hours ?? "",
      notes: member.notes ?? "",
    });
  }, [member]);

  const save = useMutation({
    mutationFn: () => persist({ data: { slug, id: memberId, ...form } }),
    onSuccess: () => {
      toast.success("Personalen är sparad.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = useMutation({
    mutationFn: (is_active: boolean) => toggleActive({ data: { slug, id: memberId, is_active } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (!member) return null;

  const clientNames = new Map(
    ((q.data?.clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  const visits = (q.data?.visits ?? []) as {
    id: string;
    title: string | null;
    starts_at: string;
    ends_at: string;
    status: string;
    client_id: string;
  }[];

  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/v/f/$slug"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Tillbaka
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {member.display_name}
          </h1>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">
            {member.is_active ? "Aktiv" : "Avaktiverad"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => active.mutate(!member.is_active)}
            disabled={active.isPending}
          >
            {member.is_active ? "Avaktivera" : "Aktivera"}
          </Button>
        </div>
      </header>

      <section className="space-y-3 rounded-3xl border border-border/70 bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Uppgifter</h2>
        <div className="space-y-1.5">
          <Label>Namn</Label>
          <Input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Roll</Label>
          <Select
            value={form.role}
            onValueChange={(v) => setForm({ ...form, role: v as "caregiver" | "org_admin" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="caregiver">Personal</SelectItem>
              <SelectItem value="org_admin">Verksamhetsadmin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>E-post</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Anställning</Label>
            <Input
              value={form.employment}
              onChange={(e) => setForm({ ...form, employment: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Arbetstider</Label>
            <Input
              value={form.work_hours}
              onChange={(e) => setForm({ ...form, work_hours: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Anteckningar</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <Button
          disabled={form.display_name.trim().length < 2 || save.isPending}
          onClick={() => save.mutate()}
        >
          Spara
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Besök</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga besök inplanerade.</p>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => (
              <li key={v.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="font-medium">
                  {v.title ?? "Besök"} · {clientNames.get(v.client_id) ?? "Brukare"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(v.starts_at).toLocaleString("sv-SE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {" – "}
                  {new Date(v.ends_at).toLocaleTimeString("sv-SE", { timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
