import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Mail, PenSquare, RefreshCw, Reply, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getInbox } from "@/lib/google.functions";
import { useMailRules } from "@/lib/db";
import { MailRulesDialog } from "./MailRulesDialog";
import { ComposeMailDialog, type MailDraft } from "./ComposeMailDialog";

function address(from: string) {
  const match = /<([^>]+)>/.exec(from);
  return (match?.[1] ?? from).trim();
}

function sender(from: string) {
  const match = /^(.*?)\s*</.exec(from);
  return (match?.[1] ?? from).replace(/"/g, "").trim() || from;
}

/** Olästa mejl från Gmail direkt på översikten. */
export function InboxCard() {
  const fetchInbox = useServerFn(getInbox);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState<MailDraft | null>(null);

  function compose(next: MailDraft) {
    setDraft(next);
    setComposeOpen(true);
  }
  const rulesQ = useMailRules();
  const rules = rulesQ.data ?? [];
  const activeRules = rules.filter((r) => r.is_active).length;
  const ruleKey = rules
    .filter((r) => r.is_active)
    .map((r) => `${r.mode}:${r.kind}:${r.value}`)
    .join("|");
  const query = useQuery({
    queryKey: ["gmail", "unread", ruleKey],
    queryFn: () => fetchInbox({ data: { query: "is:unread in:inbox", max: 5 } }),
    refetchInterval: 5 * 60 * 1000,
  });

  const data = query.data;

  return (
    <section className="card-soft p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-[hsl(var(--cat-jobb))]" /> Inkorg
        </h2>
        <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Skriv nytt mejl"
          onClick={() => compose({ to: "", subject: "", body: "" })}
        >
          <PenSquare className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Mejlregler"
          onClick={() => setRulesOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Uppdatera inkorgen"
          onClick={() => query.refetch()}
        >
          <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
        </Button>
        </div>
      </div>

      {activeRules > 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {activeRules} aktiv{activeRules === 1 ? " regel" : "a regler"} filtrerar inkorgen
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Hämtar mejl…</p>
      ) : !data?.connected ? (
        <p className="mt-3 text-sm text-muted-foreground">Gmail är inte kopplat ännu.</p>
      ) : data.mails.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {"error" in data && data.error ? data.error : "Inga olästa mejl. Snyggt jobbat."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.mails.map((mail) => (
            <li
              key={mail.id}
              className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{mail.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {sender(mail.from)} · {mail.snippet}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Svara på ${mail.subject}`}
                onClick={() =>
                  compose({
                    to: address(mail.from),
                    subject: mail.subject.toLowerCase().startsWith("sv:")
                      ? mail.subject
                      : `Sv: ${mail.subject}`,
                    body: "",
                  })
                }
              >
                <Reply className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <MailRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <ComposeMailDialog open={composeOpen} onOpenChange={setComposeOpen} draft={draft} />
    </section>
  );
}
