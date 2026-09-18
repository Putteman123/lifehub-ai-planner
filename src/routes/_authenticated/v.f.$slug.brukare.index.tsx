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
import { Textarea } from "@/components/ui/textarea";
import { StatGrid, StatLine, emptyStat, type CareStat } from "@/components/care/CareStats";
import { CareAvatar, CareNavigateButton, CareSectionHeader } from "@/components/care/CareUI";
import { CareAssistant } from "@/components/care/CareAssistant";
import careClientsImage from "@/assets/care-clients.jpg";
import { Users } from "lucide-react";
import { getAdminOrg, saveClient } from "@/lib/care-admin.functions";
import { useDemoRole } from "@/lib/demo-role";

export const Route = createFileRoute("/_authenticated/v/f/$slug/brukare/")({
  head: () => ({
    meta: [
      { title: "Brukare – LifeHub Vård" },
      { name: "description", content: "Verksamhetens brukare med adress och kontaktuppgifter." },
      { property: "og:title", content: "Brukare – LifeHub Vård" },
      {
        property: "og:description",
        content: "Verksamhetens brukare med adress och kontaktuppgifter.",
      },
    ],
  }),
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  personal_number: string | null;
  door_code: string | null;
  lat: number | null;
  lng: number | null;
};

const emptyClient = {
  id: undefined as string | undefined,
  name: "",
  personal_number: "",
  address: "",
  phone: "",
  door_code: "",
  key_info: "",
  notes: "",
};

function ClientsPage() {
  const { slug } = Route.useParams();
  const { role } = useDemoRole();
  const qc = useQueryClient();
  const fetchOrg = useServerFn(getAdminOrg);
  const persistClient = useServerFn(saveClient);

  const q = useQuery({
    queryKey: ["care-admin-org", slug],
    queryFn: () => fetchOrg({ data: { slug } }),
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyClient });

  const mutation = useMutation({
    mutationFn: () => persistClient({ data: { slug, ...form } }),
    onSuccess: () => {
      toast.success("Brukaren är sparad.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["care-admin-org", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needle = search.trim().toLowerCase();
  const clients = useMemo(
    () =>
      ((q.data?.clients ?? []) as Client[]).filter((c) =>
        needle ? c.name.toLowerCase().includes(needle) : true,
      ),
    [q.data, needle],
  );

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const stats = q.data?.stats;
  const clientStats = (stats?.clients ?? {}) as Record<string, CareStat>;

  return (
    <div className="space-y-6">
      <CareSectionHeader
        icon={<Users className="size-5" />}
        title="Brukare"
        subtitle={`${clients.length} brukare i verksamheten`}
        image={careClientsImage}
        action={role === "admin" ? (
          <Button
            size="sm"
            onClick={() => {
              setForm({ ...emptyClient });
              setOpen(true);
            }}
          >
            Lägg till
          </Button>
        ) : undefined}
      />

      {stats ? <StatGrid stat={stats.total as CareStat} days={stats.days} /> : null}

      <Input
        placeholder="Sök brukare"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga brukare upplagda ännu.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <CareAvatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.address ?? "Ingen adress"}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
                <StatLine stat={clientStats[c.id] ?? emptyStat} />
              </div>
              <CareNavigateButton lat={c.lat} lng={c.lng} address={c.address} size="xs" />
              <Button asChild variant="ghost" size="sm">
                <Link to="/v/f/$slug/brukare/$clientId" params={{ slug, clientId: c.id }}>
                  Öppna
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CareAssistant slug={slug} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny brukare</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Namn">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Personnummer">
                <Input
                  value={form.personal_number}
                  onChange={(e) => setForm({ ...form, personal_number: e.target.value })}
                />
              </Field>
              <Field label="Telefon">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Adress">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Portkod">
                <Input
                  value={form.door_code}
                  onChange={(e) => setForm({ ...form, door_code: e.target.value })}
                />
              </Field>
              <Field label="Nyckelinfo">
                <Input
                  value={form.key_info}
                  onChange={(e) => setForm({ ...form, key_info: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Anteckningar">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              disabled={form.name.trim().length < 2 || mutation.isPending}
              onClick={() => mutation.mutate()}
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
