import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CareSection } from "@/components/care/CareChrome";
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
import { submitLead } from "@/lib/care.functions";

export const Route = createFileRoute("/vard/kontakt")({
  head: () => ({
    meta: [
      { title: "Boka demo av livo.health – kontakt och offert" },
      {
        name: "description",
        content:
          "Berätta kort om er verksamhet så visar vi livo.health och sätter upp en pilot med påhittade brukare.",
      },
      { property: "og:title", content: "Boka demo av livo.health" },
      {
        property: "og:description",
        content: "Demo och offert för kommun, region och privata vårdaktörer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KontaktPage,
});

function KontaktPage() {
  const send = useServerFn(submitLead);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    org_name: "",
    contact_name: "",
    email: "",
    phone: "",
    segment: "kommun",
    message: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send({ data: form });
      setSent(true);
      toast.success("Tack! Vi hör av oss inom kort.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CareSection eyebrow="Kontakt" title="Boka demo eller be om en offert">
      {sent ? (
        <div className="rounded-md border border-border/70 bg-card p-8">
          <h3 className="font-display text-xl font-semibold">Tack för din förfrågan</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Vi återkommer till {form.email} med förslag på tid för en genomgång.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid max-w-2xl gap-5 rounded-md border border-border/70 bg-card p-7 shadow-sm"
        >
          <div className="grid gap-2">
            <Label htmlFor="org_name">Verksamhet</Label>
            <Input
              id="org_name"
              required
              value={form.org_name}
              onChange={(e) => set("org_name")(e.target.value)}
              placeholder="Till exempel Hemsjukvården, Norrköpings kommun"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact_name">Kontaktperson</Label>
              <Input
                id="contact_name"
                required
                value={form.contact_name}
                onChange={(e) => set("contact_name")(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="segment">Typ av verksamhet</Label>
              <Select value={form.segment} onValueChange={set("segment")}>
                <SelectTrigger id="segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kommun">Kommun</SelectItem>
                  <SelectItem value="region">Region</SelectItem>
                  <SelectItem value="privat">Privat vårdaktör</SelectItem>
                  <SelectItem value="annat">Annat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Vad vill ni lösa?</Label>
            <Textarea
              id="message"
              rows={4}
              value={form.message}
              onChange={(e) => set("message")(e.target.value)}
              placeholder="Antal medarbetare, hur schemat läggs idag, vad som skaver."
            />
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Skickar…" : "Skicka förfrågan"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Vi använder uppgifterna enbart för att kontakta er om livo.health.
          </p>
        </form>
      )}
    </CareSection>
  );
}
