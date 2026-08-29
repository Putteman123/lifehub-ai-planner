import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Copy, MessageSquare, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { SectionCard } from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cancelOutboxSms, getSmsWebhook, markSmsRead } from "@/lib/sms.functions";

export const Route = createFileRoute("/_authenticated/sms")({
  head: () => ({
    meta: [
      { title: "SMS – LifeHub AI" },
      {
        name: "description",
        content:
          "Läs dina SMS i LifeHub och låt Andrea förbereda svar som skickas via iOS Genvägar efter ditt godkännande.",
      },
      { property: "og:title", content: "SMS – LifeHub AI" },
      {
        property: "og:description",
        content: "SMS-historik, utkorg och installationsguide för iOS Genvägar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SmsPage,
});

type SmsRow = {
  id: string;
  direction: string;
  contact: string | null;
  phone: string;
  body: string;
  sent_at: string;
  is_read: boolean;
};

type OutboxRow = {
  id: string;
  phone: string;
  contact: string | null;
  body: string;
  status: string;
  error: string | null;
  created_at: string;
};

function when(value: string) {
  return new Date(value).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SmsPage() {
  const qc = useQueryClient();
  const [showToken, setShowToken] = useState(false);

  const messagesQ = useQuery({
    queryKey: ["sms_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("id, direction, contact, phone, body, sent_at, is_read")
        .order("sent_at", { ascending: false })
        .limit(80);
      if (error) throw new Error(error.message);
      return (data ?? []) as SmsRow[];
    },
  });

  const outboxQ = useQuery({
    queryKey: ["sms_outbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_outbox")
        .select("id, phone, contact, body, status, error, created_at")
        .in("status", ["approved", "failed"])
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as OutboxRow[];
    },
  });

  const hookQ = useQuery({
    queryKey: ["sms_webhook"],
    queryFn: () => getSmsWebhook(),
    staleTime: Infinity,
  });

  const messages = messagesQ.data ?? [];
  const outbox = outboxQ.data ?? [];
  const unread = messages.filter((m) => m.direction === "in" && !m.is_read);
  const url = hookQ.data?.url ?? "";

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Adressen är kopierad.");
    } catch {
      setShowToken(true);
      toast.message("Kopiering blockerad – markera adressen manuellt.");
    }
  }

  async function markAllRead() {
    await markSmsRead({ data: { ids: unread.map((m) => m.id) } });
    qc.invalidateQueries({ queryKey: ["sms_messages"] });
  }

  async function cancel(id: string) {
    await cancelOutboxSms({ data: { id } });
    toast.success("Meddelandet är avbrutet.");
    qc.invalidateQueries({ queryKey: ["sms_outbox"] });
  }

  return (
    <AppShell title="SMS" subtitle="Läs, förbered och godkänn SMS – synkas via iOS Genvägar.">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Utkorg" icon={ArrowUpRight} count={outbox.length}>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inget väntar på att skickas.</p>
          ) : (
            <ul className="space-y-2">
              {outbox.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{row.contact || row.phone}</span>
                      {row.status === "failed" ? (
                        <Badge variant="destructive">Misslyckades</Badge>
                      ) : (
                        <Badge variant="secondary">Väntar</Badge>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {row.body}
                    </p>
                    {row.error ? (
                      <p className="mt-1 text-xs text-destructive">{row.error}</p>
                    ) : null}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => cancel(row.id)} aria-label="Avbryt">
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Koppla iPhone" icon={Smartphone}>
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
              <p className="mb-2 font-medium">Webhook-adress</p>
              <code className="block break-all text-xs text-muted-foreground">
                {showToken || !url ? url || "Inte konfigurerad" : url.replace(/token=.*/, "token=••••••")}
              </code>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={copyUrl} disabled={!url}>
                  <Copy className="mr-1 size-3.5" /> Kopiera
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowToken((v) => !v)}>
                  {showToken ? "Dölj" : "Visa"}
                </Button>
              </div>
            </div>

            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Inkommande:</strong> Genvägar → Automation → “När
                jag får ett meddelande” → Hämta innehåll från URL, metod POST, JSON med fälten{" "}
                <code>phone</code>, <code>contact</code>, <code>body</code>.
              </li>
              <li>
                <strong className="text-foreground">Utgående:</strong> ny genväg som hämtar samma adress
                med GET, går igenom <code>messages</code>, skickar via Meddelanden och sedan POST:ar{" "}
                <code>{"{ \"ack\": [id] }"}</code> tillbaka.
              </li>
              <li>Kör den utgående genvägen manuellt eller på ett schema, t.ex. var 15:e minut.</li>
            </ol>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Smartphone className="size-3.5" /> Andrea skickar aldrig ett SMS utan att du sagt ja i
              chatten först.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Historik"
        icon={MessageSquare}
        count={unread.length}
        action={
          unread.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={markAllRead}>
              Markera lästa
            </Button>
          ) : undefined
        }
      >
        <DataGate queries={[messagesQ]}>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga SMS ännu – koppla genvägen på iPhone.
            </p>
          ) : null}
          <ul className="space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-2xl border p-3 ${
                  m.direction === "in"
                    ? m.is_read
                      ? "border-border/70 bg-card/60"
                      : "border-primary/30 bg-primary/5"
                    : "border-border/70 bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {m.direction === "in" ? (
                    <ArrowDownLeft className="size-4 text-nav-oversikt" />
                  ) : (
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  )}
                  <span className="truncate">{m.contact || m.phone}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {when(m.sent_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
              </li>
            ))}
          </ul>
        </DataGate>
      </SectionCard>
    </AppShell>
  );
}
