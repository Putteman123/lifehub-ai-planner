import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type Category } from "@/lib/categories";
import { fmt } from "@/lib/calendar";
import { useCalendars, useDeleteRow, useUpsertRow } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/kalendrar")({
  head: () => ({
    meta: [
      { title: "Kalendrar – LifeHub AI" },
      { name: "description", content: "Koppla Google, Outlook, Apple och ICS-kalendrar." },
      { property: "og:title", content: "Kalendrar – LifeHub AI" },
      { property: "og:description", content: "Obegränsat antal kalendrar synkade i en vy." },
    ],
  }),
  component: CalendarsPage,
});

const PROVIDERS = [
  { value: "local", label: "Egen kalender" },
  { value: "ics", label: "ICS / prenumeration" },
  { value: "google", label: "Google Calendar" },
  { value: "outlook", label: "Outlook Calendar" },
  { value: "apple", label: "Apple Calendar" },
] as const;

function CalendarsPage() {
  const calendarsQ = useCalendars();
  const calendars = calendarsQ.data ?? [];
  const upsert = useUpsertRow("calendars");
  const remove = useDeleteRow("calendars");

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<string>("ics");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<Category>("privat");

  async function save() {
    if (!name.trim()) return;
    await upsert.mutateAsync({
      name: name.trim(),
      source: provider as "apple" | "family" | "google" | "ics" | "local" | "outlook" | "school" | "sports",
      ics_url: url || null,
      color: category,
    });
    setName("");
    setUrl("");
    setOpen(false);
  }

  return (
    <AppShell
      title="Kalendrar"
      subtitle="Importera och synkronisera obegränsat antal källor"
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Lägg till
        </Button>
      }
    >
      <DataGate queries={[calendarsQ]}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {calendars.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Inga kalendrar ännu. Lägg till en ICS-länk från skolan, träningen eller familjen.
          </div>
        ) : null}
        {calendars.map((c) => {
          const meta = CATEGORIES.find((x) => x.value === c.color) ?? CATEGORIES[0]!;
          return (
            <div key={c.id} className="card-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {PROVIDERS.find((p) => p.value === c.source)?.label ?? c.source}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${meta.chip}`}>
                  {meta.label}
                </span>
              </div>
              {c.ics_url ? (
                <p className="mt-2 truncate text-xs text-muted-foreground">{c.ics_url}</p>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {c.last_synced_at ? `Synkad ${fmt(c.last_synced_at, "d MMM HH:mm")}` : "Ej synkad"}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      upsert.mutate({ id: c.id, last_synced_at: new Date().toISOString() })
                    }
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till kalender</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cal-name">Namn</Label>
              <Input
                id="cal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Benjamins fotboll"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Källa</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {provider !== "local" ? (
              <div className="space-y-1.5">
                <Label htmlFor="cal-url">Länk (ICS/webcal)</Label>
                <Input
                  id="cal-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Standardkategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </DataGate>
    </AppShell>
  );
}
