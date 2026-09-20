import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Inbox, Mail, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CareSectionHeader } from "@/components/care/CareUI";
import {
  deleteThread,
  getInboxThread,
  listInboxThreads,
  replyToThread,
  saveInboxSettings,
  setThreadStatus,
} from "@/lib/care-inbox.functions";
import {
  addMarketingContacts,
  listCampaigns,
  listCampaignRecipients,
  sendCampaign,
} from "@/lib/care-campaigns.functions";

export const Route = createFileRoute("/_authenticated/v/inkorg")({
  head: () => ({
    meta: [
      { title: "Inkorg – livo.health" },
      {
        name: "description",
        content: "Läs och besvara förfrågningar från livo.health och skicka utskick till kunder.",
      },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const [tab, setTab] = useState<"inkorg" | "utskick">("inkorg");
  return (
    <div className="space-y-6">
      <CareSectionHeader
        icon={<Inbox className="size-5" />}
        title="Inkorg"
        subtitle="Förfrågningar från livo.health och utskick till potentiella kunder."
      />
      <div className="flex gap-2">
        <TabButton active={tab === "inkorg"} onClick={() => setTab("inkorg")} label="Inkorg" />
        <TabButton active={tab === "utskick"} onClick={() => setTab("utskick")} label="Utskick" />
      </div>
      {tab === "inkorg" ? <InboxTab /> : <CampaignTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {label}
    </button>
  );
}

const STATUS_LABEL: Record<string, string> = { ny: "Ny", pagar: "Pågår", klar: "Klar" };

function InboxTab() {
  const qc = useQueryClient();
  const fetchThreads = useServerFn(listInboxThreads);
  const fetchThread = useServerFn(getInboxThread);
  const reply = useServerFn(replyToThread);
  const status = useServerFn(setThreadStatus);
  const remove = useServerFn(deleteThread);
  const saveSettings = useServerFn(saveInboxSettings);

  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"alla" | "ny" | "pagar" | "klar">("alla");
  const [search, setSearch] = useState("");
  const [answer, setAnswer] = useState("");
  const [forwardEmail, setForwardEmail] = useState<string | null>(null);
  const [forwardOn, setForwardOn] = useState<boolean | null>(null);

  const list = useQuery({ queryKey: ["care-inbox"], queryFn: () => fetchThreads({}) });
  const thread = useQuery({
    queryKey: ["care-inbox-thread", openId],
    queryFn: () => fetchThread({ data: { id: openId! } }),
    enabled: !!openId,
  });

  const email = forwardEmail ?? list.data?.settings.forward_email ?? "";
  const enabled = forwardOn ?? list.data?.settings.forward_enabled ?? true;

  const sendReply = useMutation({
    mutationFn: () => reply({ data: { id: openId!, body: answer } }),
    onSuccess: (r) => {
      setAnswer("");
      toast.success(r.sent ? "Svaret är skickat." : "Mottagaren har avregistrerat sig.");
      void qc.invalidateQueries({ queryKey: ["care-inbox-thread", openId] });
      void qc.invalidateQueries({ queryKey: ["care-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const threads = (list.data?.threads ?? []).filter((t) => {
    if (filter !== "alla" && t.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.from_name.toLowerCase().includes(q) ||
      t.from_email.toLowerCase().includes(q) ||
      (t.org_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border/70 bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Mail className="size-4" /> Vidarebefordran
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Varje ny förfrågan skickas vidare till din mejladress.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="fwd">Mejladress</Label>
            <Input
              id="fwd"
              value={email}
              onChange={(e) => setForwardEmail(e.target.value)}
              placeholder="din@adress.se"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={enabled} onCheckedChange={(v) => setForwardOn(v)} id="fwd-on" />
            <Label htmlFor="fwd-on">Påslagen</Label>
          </div>
          <Button
            onClick={async () => {
              await saveSettings({ data: { forward_email: email, forward_enabled: enabled } });
              toast.success("Sparat.");
              void qc.invalidateQueries({ queryKey: ["care-inbox"] });
            }}
          >
            Spara
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök namn, mejl eller verksamhet"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["alla", "ny", "pagar", "klar"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {f === "alla" ? "Alla" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {list.isLoading ? <p className="text-sm text-muted-foreground">Hämtar…</p> : null}
            {!list.isLoading && threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga förfrågningar ännu.</p>
            ) : null}
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setOpenId(t.id);
                  setAnswer("");
                }}
                className={`w-full rounded-md border p-3 text-left transition ${
                  openId === t.id ? "border-primary bg-primary/5" : "border-border/70 bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {t.unread ? "● " : ""}
                    {t.org_name || t.from_name}
                  </span>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{t.from_email}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(t.last_message_at).toLocaleString("sv-SE")}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-card p-5">
          {!openId ? (
            <p className="text-sm text-muted-foreground">Välj en förfrågan i listan.</p>
          ) : thread.isLoading ? (
            <p className="text-sm text-muted-foreground">Hämtar…</p>
          ) : thread.data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold">{thread.data.thread.subject}</h3>
                <p className="text-sm text-muted-foreground">
                  {thread.data.thread.from_name} · {thread.data.thread.from_email}
                </p>
              </div>
              <div className="space-y-2">
                {thread.data.messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-3 text-sm whitespace-pre-wrap ${
                      m.direction === "in" ? "bg-secondary" : "bg-primary/10"
                    }`}
                  >
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      {m.direction === "in" ? "Från kunden" : "Ditt svar"} ·{" "}
                      {new Date(m.created_at).toLocaleString("sv-SE")}
                    </p>
                    {m.body}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="svar">Svara</Label>
                <Textarea
                  id="svar"
                  rows={5}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Skriv ditt svar…"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={answer.trim().length < 2 || sendReply.isPending}
                    onClick={() => sendReply.mutate()}
                  >
                    <Send className="size-4" /> Skicka svar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await status({
                        data: {
                          id: openId,
                          status: thread.data.thread.status === "klar" ? "pagar" : "klar",
                        },
                      });
                      void qc.invalidateQueries({ queryKey: ["care-inbox"] });
                      void qc.invalidateQueries({ queryKey: ["care-inbox-thread", openId] });
                    }}
                  >
                    {thread.data.thread.status === "klar" ? "Återöppna" : "Markera som klar"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await remove({ data: { id: openId } });
                      setOpenId(null);
                      void qc.invalidateQueries({ queryKey: ["care-inbox"] });
                    }}
                  >
                    <Trash2 className="size-4" /> Ta bort
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CampaignTab() {
  const qc = useQueryClient();
  const fetchRecipients = useServerFn(listCampaignRecipients);
  const addContacts = useServerFn(addMarketingContacts);
  const send = useServerFn(sendCampaign);
  const fetchHistory = useServerFn(listCampaigns);

  const [groups, setGroups] = useState<Record<string, boolean>>({
    leads: true,
    customers: false,
    own: false,
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [paste, setPaste] = useState("");
  const [testTo, setTestTo] = useState("");

  const recipients = useQuery({
    queryKey: ["care-campaign-recipients"],
    queryFn: () => fetchRecipients({}),
  });
  const history = useQuery({ queryKey: ["care-campaigns"], queryFn: () => fetchHistory({}) });

  const selected = (() => {
    const all: { email: string; name: string; org: string }[] = [];
    const d = recipients.data;
    if (!d) return all;
    if (groups["leads"]) all.push(...d.leads);
    if (groups["customers"]) all.push(...d.customers);
    if (groups["own"]) all.push(...d.own);
    const seen = new Set<string>();
    return all.filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)));
  })();

  const sendAll = useMutation({
    mutationFn: () => send({ data: { subject, body, recipients: selected } }),
    onSuccess: (r) => {
      toast.success(`Skickat till ${r.sent} · hoppade över ${r.skipped} · fel ${r.failed}`);
      void qc.invalidateQueries({ queryKey: ["care-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border/70 bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Users className="size-4" /> Mottagare
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <GroupToggle
            label="Intresseanmälningar"
            count={recipients.data?.leads.length ?? 0}
            on={!!groups["leads"]}
            toggle={() => setGroups((g) => ({ ...g, leads: !g["leads"] }))}
          />
          <GroupToggle
            label="Befintliga kunder"
            count={recipients.data?.customers.length ?? 0}
            on={!!groups["customers"]}
            toggle={() => setGroups((g) => ({ ...g, customers: !g["customers"] }))}
          />
          <GroupToggle
            label="Egen lista"
            count={recipients.data?.own.length ?? 0}
            on={!!groups["own"]}
            toggle={() => setGroups((g) => ({ ...g, own: !g["own"] }))}
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="paste">Lägg till egna mottagare (en per rad: Namn &lt;mejl&gt;)</Label>
          <Textarea
            id="paste"
            rows={3}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Anna Karlsson <anna@exempel.se>\nkontakt@exempel.se"}
          />
          <Button
            variant="outline"
            onClick={async () => {
              const r = await addContacts({ data: { text: paste } });
              setPaste("");
              toast.success(`${r.added} mottagare tillagda.`);
              void qc.invalidateQueries({ queryKey: ["care-campaign-recipients"] });
            }}
          >
            Lägg till i listan
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {selected.length} mottagare valda.
        </p>
      </div>

      <div className="rounded-md border border-border/70 bg-card p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">Meddelande</h2>
        <div>
          <Label htmlFor="amne">Ämne</Label>
          <Input
            id="amne"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nyheter från livo.health"
          />
        </div>
        <div>
          <Label htmlFor="text">Text</Label>
          <Textarea
            id="text"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hej {namn},\n\nvi vill visa hur {verksamhet} kan planera besök snabbare."}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {"{namn}"} och {"{verksamhet}"} fylls i automatiskt per mottagare.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="test">Testutskick till</Label>
            <Input
              id="test"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="din@adress.se"
            />
          </div>
          <Button
            variant="outline"
            disabled={!testTo || subject.length < 2 || body.length < 5}
            onClick={async () => {
              const r = await send({
                data: {
                  subject,
                  body,
                  test: true,
                  recipients: [{ email: testTo, name: "Test", org: "Testverksamhet" }],
                },
              });
              toast.success(r.sent ? "Testmejlet är skickat." : "Testmejlet gick inte fram.");
            }}
          >
            Skicka test
          </Button>
          <Button
            disabled={selected.length === 0 || subject.length < 2 || body.length < 5 || sendAll.isPending}
            onClick={() => sendAll.mutate()}
          >
            <Send className="size-4" /> Skicka till {selected.length} mottagare
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border/70 bg-card p-5">
        <h2 className="font-display text-base font-semibold">Tidigare utskick</h2>
        <div className="mt-3 space-y-2">
          {(history.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga utskick ännu.</p>
          ) : (
            (history.data ?? []).map((c: any) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/60 px-3 py-2 text-sm"
              >
                <span className="font-medium">{c.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("sv-SE")} · {c.sent_count} skickade ·{" "}
                  {c.skipped_count} hoppade över · {c.failed_count} fel
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function GroupToggle({
  label,
  count,
  on,
  toggle,
}: {
  label: string;
  count: number;
  on: boolean;
  toggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md border p-3 text-left text-sm transition ${
        on ? "border-primary bg-primary/5" : "border-border/70 bg-background"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="block text-xs text-muted-foreground">{count} mottagare</span>
    </button>
  );
}
