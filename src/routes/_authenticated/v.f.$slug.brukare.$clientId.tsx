import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getClientDetail,
  removeMedication,
  removeRelative,
  saveMedication,
  saveRelative,
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

const emptyRelative = { name: "", relation: "", phone: "", email: "" };
const emptyMed = { name: "", dose: "", times: "", instructions: "" };

function ClientDetail() {
  const { slug, clientId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getClientDetail);
  const persistRelative = useServerFn(saveRelative);
  const deleteRelative = useServerFn(removeRelative);
  const persistMed = useServerFn(saveMedication);
  const deleteMed = useServerFn(removeMedication);

  const [relative, setRelative] = useState({ ...emptyRelative });
  const [med, setMed] = useState({ ...emptyMed });

  const q = useQuery({
    queryKey: ["care-client", slug, clientId],
    queryFn: () => fetchDetail({ data: { slug, clientId } }),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["care-client", slug, clientId] });

  const addRelative = useMutation({
    mutationFn: () =>
      persistRelative({
        data: {
          slug,
          clientId,
          name: relative.name.trim(),
          relation: relative.relation || undefined,
          phone: relative.phone || undefined,
          email: relative.email || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Anhörig tillagd.");
      setRelative({ ...emptyRelative });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMed = useMutation({
    mutationFn: () =>
      persistMed({
        data: {
          slug,
          clientId,
          name: med.name.trim(),
          dose: med.dose || undefined,
          times: med.times || undefined,
          instructions: med.instructions || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Medicinen är tillagd.");
      setMed({ ...emptyMed });
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

  const client = q.data!.client as {
    name: string;
    address: string | null;
    phone: string | null;
    personal_number: string | null;
    door_code: string | null;
    key_info: string | null;
    notes: string | null;
  };

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
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{client.name}</h1>
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
        {(q.data?.relatives ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga anhöriga registrerade.</p>
        ) : (
          <ul className="space-y-2">
            {(q.data!.relatives as {
              id: string;
              name: string;
              relation: string | null;
              phone: string | null;
              email: string | null;
            }[]).map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[r.relation, r.phone, r.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => delRelative.mutate(r.id)}>
                  Ta bort
                </Button>
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
          <Button
            className="sm:col-span-2"
            disabled={relative.name.trim().length < 2 || addRelative.isPending}
            onClick={() => addRelative.mutate()}
          >
            Lägg till anhörig
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Medicinlista</h2>
        {(q.data?.medications ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga mediciner registrerade.</p>
        ) : (
          <ul className="space-y-2">
            {(q.data!.medications as {
              id: string;
              name: string;
              dose: string | null;
              times: string | null;
              instructions: string | null;
            }[]).map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.name} {m.dose ? <span className="text-muted-foreground">{m.dose}</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[m.times, m.instructions].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
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
          <Button
            className="sm:col-span-2"
            disabled={med.name.trim().length < 1 || addMed.isPending}
            onClick={() => addMed.mutate()}
          >
            Lägg till medicin
          </Button>
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
    </div>
  );
}
