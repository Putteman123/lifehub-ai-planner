import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listTemplates, removeTemplate, saveTemplate } from "@/lib/care-admin.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/insatser")({
  head: () => ({
    meta: [
      { title: "Insatser – LifeHub Vård" },
      { name: "description", content: "Mallar för återkommande insatser hos brukarna." },
      { property: "og:title", content: "Insatser – LifeHub Vård" },
      { property: "og:description", content: "Mallar för återkommande insatser hos brukarna." },
    ],
  }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  title: string;
  description: string | null;
  default_minutes: number;
};

function TemplatesPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const fetchTemplates = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const remove = useServerFn(removeTemplate);

  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState("30");

  const q = useQuery({
    queryKey: ["care-templates", slug],
    queryFn: () => fetchTemplates({ data: { slug } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["care-templates", slug] });

  const reset = () => {
    setEditId(undefined);
    setTitle("");
    setDescription("");
    setMinutes("30");
  };

  const create = useMutation({
    mutationFn: () =>
      save({
        data: {
          slug,
          id: editId,
          title: title.trim(),
          description: description.trim() || undefined,
          default_minutes: Math.max(5, Math.min(480, Number(minutes) || 30)),
        },
      }),
    onSuccess: () => {
      toast.success(editId ? "Insatsen är uppdaterad." : "Insatsen är sparad.");
      reset();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { slug, id } }),
    onSuccess: () => {
      toast.success("Insatsen är borttagen.");
      if (editId) reset();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const templates = (q.data?.templates ?? []) as Template[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Insatser</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mallar som personalen kan lägga till på ett besök.
        </p>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Input placeholder="Namn, t.ex. Dusch" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            type="number"
            min={5}
            max={480}
            placeholder="Minuter"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <Textarea
          className="mt-3"
          placeholder="Beskrivning (valfritt)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <Button
            disabled={title.trim().length < 2 || create.isPending}
            onClick={() => create.mutate()}
          >
            {editId ? "Spara insats" : "Lägg till insats"}
          </Button>
          {editId ? (
            <Button variant="ghost" onClick={reset}>
              Avbryt
            </Button>
          ) : null}
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga insatser upplagda ännu.</p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.default_minutes} min{t.description ? ` · ${t.description}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditId(t.id);
                  setTitle(t.title);
                  setDescription(t.description ?? "");
                  setMinutes(String(t.default_minutes));
                }}
              >
                Ändra
              </Button>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(t.id)}>
                Ta bort
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
