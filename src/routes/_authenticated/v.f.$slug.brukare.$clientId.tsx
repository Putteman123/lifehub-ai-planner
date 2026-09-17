import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CareClientChat } from "@/components/care/CareClientChat";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  CONSENT_SCOPES,
  getClientDetail,
  logMedicationEvent,
  removeMedication,
  removeRelative,
  saveClient,
  saveMedication,
  saveRelative,
  setRelativeConsent,
} from "@/lib/care-admin.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/brukare/$clientId")({
  head: () => ({
    meta: [
      { title: "Brukare – LifeHub Vård" },
      { name: "description", content: "Brukarens uppgifter, anhöriga, medicinlista och besök." },
      { property: "og:title", content: "Brukare – LifeHub Vård" },
      {
        property: "og:description",
        content: "Brukarens uppgifter, anhöriga, medicinlista och besök.",
      },
    ],
  }),
  component: ClientDetail,
});

type Client = {
  name: string;
  address: string | null;
  phone: string | null;
  personal_number: string | null;
  door_code: string | null;
  key_info: string | null;
  notes: string | null;
};

type Relative = {
  id: string;
  name: string;
  relation: string | null;
  phone: string | null;
  email: string | null;
  consent: Record<string, boolean> | null;
};

type Medication = {
  id: string;
  name: string;
  dose: string | null;
  times: string | null;
  instructions: string | null;
};

const emptyRelative = { id: undefined as string | undefined, name: "", relation: "", phone: "", email: "" };
const emptyMed = { id: undefined as string | undefined, name: "", dose: "", times: "", instructions: "" };

function ClientDetail() {
  const { slug, clientId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getClientDetail);
  const persistClient = useServerFn(saveClient);
  const persistRelative = useServerFn(saveRelative);
  const deleteRelative = useServerFn(removeRelative);
  const persistConsent = useServerFn(setRelativeConsent);
  const persistMed = useServerFn(saveMedication);
  const deleteMed = useServerFn(removeMedication);
  const logMed = useServerFn(logMedicationEvent);

  const [relative, setRelative] = useState({ ...emptyRelative });
  const [med, setMed] = useState({ ...emptyMed });
  const [clientOpen, setClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "",
    personal_number: "",
    address: "",
    phone: "",
    door_code: "",
    key_info: "",
    notes: "",
  });

  const q = useQuery({
    queryKey: ["care-client", slug, clientId],
    queryFn: () => fetchDetail({ data: { slug, clientId } }),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["care-client", slug, clientId] });

  const saveClientMutation = useMutation({
    mutationFn: () => persistClient({ data: { slug, id: clientId, ...clientForm } }),
    onSuccess: () => {
      toast.success("Uppgifterna är sparade.");
      setClientOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsertRelative = useMutation({
    mutationFn: () =>
      persistRelative({
        data: {
          slug,
          id: relative.id,
          clientId,
          name: relative.name.trim(),
          relation: relative.relation || undefined,
          phone: relative.phone || undefined,
          email: relative.email || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(relative.id ? "Anhörig uppdaterad." : "Anhörig tillagd.");
      setRelative({ ...emptyRelative });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsertMed = useMutation({
    mutationFn: () =>
      persistMed({
        data: {
          slug,
          id: med.id,
          clientId,
          name: med.name.trim(),
          dose: med.dose || undefined,
          times: med.times || undefined,
          instructions: med.instructions || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(med.id ? "Medicinen är uppdaterad." : "Medicinen är tillagd.");
      setMed({ ...emptyMed });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const consentMutation = useMutation({
    mutationFn: (v: { id: string; consent: Record<string, boolean> }) =>
      persistConsent({ data: { slug, id: v.id, consent: v.consent } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const givenMutation = useMutation({
    mutationFn: (medicationId: string) => logMed({ data: { slug, medicationId } }),
    onSuccess: () => {
      toast.success("Noterat som given.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delRelative = useMutation({
    mutationFn: (id: string) => deleteRelative({ data: { slug, id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const delMed = useMutation({
    mutationFn: (id: string) => deleteMed({ data: { slug, id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const client = q.data!.client as Client;
  const relatives = (q.data?.relatives ?? []) as Relative[];
  const medications = (q.data?.medications ?? []) as Medication[];
  const events = (q.data?.medicationEvents ?? []) as {
    id: string;
    medication_id: string;
    given_at: string;
  }[];

  const lastGiven = (medicationId: string) =>
    events.find((e) => e.medication_id === medicationId)?.given_at ?? null;

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
          <h1 className="font-display text-2xl font-semibold tracking-tight">{client.name}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClientForm({
                name: client.name,
                personal_number: client.personal_number ?? "",
                address: client.address ?? "",
                phone: client.phone ?? "",
                door_code: client.door_code ?? "",
                key_info: client.key_info ?? "",
                notes: client.notes ?? "",
              });
              setClientOpen(true);
            }}
          >
            Ändra uppgifter
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[client.address, client.phone, client.personal_number].filter(Boolean).join(" · ") ||
            "Inga kontaktuppgifter"}
        </p>
        {client.door_code || client.key_info ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Portkod {client.door_code ?? "–"} · Nyckel {client.key_info ?? "–"}
          </p>
        ) : null}
        {client.notes ? <p className="mt-3 text-sm">{client.notes}</p> : null}
      </header>

      <CareClientChat clientId={clientId} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Anhöriga</h2>
        {relatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga anhöriga registrerade.</p>
        ) : (
          <ul className="space-y-2">
            {relatives.map((r) => (
              <li key={r.id} className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[r.relation, r.phone, r.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRelative({
                        id: r.id,
                        name: r.name,
                        relation: r.relation ?? "",
                        phone: r.phone ?? "",
                        email: r.email ?? "",
                      })
                    }
                  >
                    Ändra
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => delRelative.mutate(r.id)}>
                    Ta bort
                  </Button>
                </div>
                <div className="flex flex-wrap gap-4 border-t border-border/60 pt-3">
                  <span className="text-sm text-muted-foreground">Får se:</span>
                  {CONSENT_SCOPES.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(r.consent?.[s.key])}
                        onCheckedChange={(v) =>
                          consentMutation.mutate({
                            id: r.id,
                            consent: { ...(r.consent ?? {}), [s.key]: v === true },
                          })
                        }
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 rounded-3xl border border-border/70 bg-card p-4 sm:grid-cols-2">
          <Input
            placeholder="Namn"
            value={relative.name}
            onChange={(e) => setRelative({ ...relative, name: e.target.value })}
          />
          <Input
            placeholder="Relation, t.ex. dotter"
            value={relative.relation}
            onChange={(e) => setRelative({ ...relative, relation: e.target.value })}
          />
          <Input
            placeholder="Telefon"
            value={relative.phone}
            onChange={(e) => setRelative({ ...relative, phone: e.target.value })}
          />
          <Input
            placeholder="E-post"
            value={relative.email}
            onChange={(e) => setRelative({ ...relative, email: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button
              disabled={relative.name.trim().length < 2 || upsertRelative.isPending}
              onClick={() => upsertRelative.mutate()}
            >
              {relative.id ? "Spara anhörig" : "Lägg till anhörig"}
            </Button>
            {relative.id ? (
              <Button variant="ghost" onClick={() => setRelative({ ...emptyRelative })}>
                Avbryt
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Medicinlista</h2>
        {medications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga mediciner registrerade.</p>
        ) : (
          <ul className="space-y-2">
            {medications.map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.name} {m.dose ? <span className="text-muted-foreground">{m.dose}</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[m.times, m.instructions].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastGiven(m.id)
                      ? `Senast given ${new Date(lastGiven(m.id)!).toLocaleString("sv-SE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}`
                      : "Ingen utdelning noterad"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={givenMutation.isPending}
                  onClick={() => givenMutation.mutate(m.id)}
                >
                  Given
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setMed({
                      id: m.id,
                      name: m.name,
                      dose: m.dose ?? "",
                      times: m.times ?? "",
                      instructions: m.instructions ?? "",
                    })
                  }
                >
                  Ändra
                </Button>
                <Button variant="ghost" size="sm" onClick={() => delMed.mutate(m.id)}>
                  Ta bort
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 rounded-3xl border border-border/70 bg-card p-4 sm:grid-cols-2">
          <Input
            placeholder="Läkemedel"
            value={med.name}
            onChange={(e) => setMed({ ...med, name: e.target.value })}
          />
          <Input
            placeholder="Dos, t.ex. 1 tablett"
            value={med.dose}
            onChange={(e) => setMed({ ...med, dose: e.target.value })}
          />
          <Input
            placeholder="Tider, t.ex. 08:00, 20:00"
            value={med.times}
            onChange={(e) => setMed({ ...med, times: e.target.value })}
          />
          <Textarea
            placeholder="Instruktion"
            value={med.instructions}
            onChange={(e) => setMed({ ...med, instructions: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button
              disabled={med.name.trim().length < 1 || upsertMed.isPending}
              onClick={() => upsertMed.mutate()}
            >
              {med.id ? "Spara medicin" : "Lägg till medicin"}
            </Button>
            {med.id ? (
              <Button variant="ghost" onClick={() => setMed({ ...emptyMed })}>
                Avbryt
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Kommande besök</h2>
        {(q.data?.visits ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga besök inplanerade.</p>
        ) : (
          <ul className="space-y-2">
            {(q.data!.visits as {
              id: string;
              title: string | null;
              starts_at: string;
              ends_at: string;
            }[]).map((v) => (
              <li key={v.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="font-medium">{v.title ?? "Besök"}</p>
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

      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ändra brukaruppgifter</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Namn</Label>
              <Input
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Personnummer</Label>
                <Input
                  value={clientForm.personal_number}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, personal_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Adress</Label>
              <Input
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Portkod</Label>
                <Input
                  value={clientForm.door_code}
                  onChange={(e) => setClientForm({ ...clientForm, door_code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nyckelinfo</Label>
                <Input
                  value={clientForm.key_info}
                  onChange={(e) => setClientForm({ ...clientForm, key_info: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Anteckningar</Label>
              <Textarea
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={clientForm.name.trim().length < 2 || saveClientMutation.isPending}
              onClick={() => saveClientMutation.mutate()}
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
