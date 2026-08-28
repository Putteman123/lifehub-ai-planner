import { useEffect, useRef, useState } from "react";
import { Check, Mailbox, RefreshCw, X } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
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
import { kr, type AccountRow } from "@/lib/finance";
import { DEFAULT_SPEND_CATEGORIES } from "@/lib/spend-categories";
import {
  MAIL_FINDING_LABEL,
  useApproveFinding,
  useDismissFinding,
  useMailFindings,
  useScanMail,
  type MailFindingRow,
} from "@/lib/mail-findings";

const SCAN_KEY = "lifehub.mailscan.last";

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function FindingRow({ row, accounts }: { row: MailFindingRow; accounts: AccountRow[] }) {
  const approve = useApproveFinding();
  const dismiss = useDismissFinding();

  const [kind, setKind] = useState<string>(row.kind);
  const [merchant, setMerchant] = useState(row.merchant ?? row.subject ?? "");
  const [amount, setAmount] = useState(String(Math.round(Number(row.amount ?? 0))));
  const [category, setCategory] = useState(row.category ?? "");
  const [due, setDue] = useState(dateInput(row.due_date));
  const [occurred, setOccurred] = useState(dateInput(row.occurred_at));
  const [accountId, setAccountId] = useState(row.account_id ?? "");

  const categories = DEFAULT_SPEND_CATEGORIES;

  function submit() {
    approve.mutate({
      id: row.id,
      kind: kind as "faktura" | "kvitto" | "prenumeration",
      merchant: merchant.trim() || "Okänd mottagare",
      amount: num(amount),
      category: category || null,
      dueDate: due || null,
      occurredAt: occurred || null,
      accountId: accountId || null,
      intervalMonths: 1,
    });
  }

  return (
    <li className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.subject ?? "(utan ämne)"}</p>
          <p className="truncate text-xs text-muted-foreground">{row.sender}</p>
          {row.summary ? (
            <p className="mt-1 text-xs text-muted-foreground">{row.summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-nav-pengar/12 px-2 py-1 text-xs text-nav-pengar">
          {MAIL_FINDING_LABEL[row.kind] ?? row.kind} · {kr(Number(row.amount ?? 0))}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Typ</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="faktura">Att betala</SelectItem>
              <SelectItem value="kvitto">Betalt med kort</SelectItem>
              <SelectItem value="prenumeration">Prenumeration</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mottagare</Label>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Belopp (kr)</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kategori</Label>
          <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Välj" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {kind === "kvitto" ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Datum</Label>
              <Input type="date" value={occurred} onChange={(e) => setOccurred(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Konto</Label>
              <Select
                value={accountId || "none"}
                onValueChange={(v) => setAccountId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj konto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Inget konto</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">
              {kind === "faktura" ? "Förfaller" : "Nästa dragning"}
            </Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={approve.isPending}>
          <Check className="mr-1 size-4" /> Godkänn
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => dismiss.mutate(row.id)}
          disabled={dismiss.isPending}
        >
          <X className="mr-1 size-4" /> Avfärda
        </Button>
      </div>
    </li>
  );
}

/** Andreas fynd från inkorgen som väntar på ditt godkännande. */
export function MailFindingsCard({
  accounts,
  className,
}: {
  accounts: AccountRow[];
  className?: string;
}) {
  const findingsQ = useMailFindings();
  const scan = useScanMail();
  const autoRef = useRef(false);

  // Skanna automatiskt, men högst en gång i timmen.
  useEffect(() => {
    if (autoRef.current) return;
    autoRef.current = true;
    const last = Number(window.localStorage.getItem(SCAN_KEY) ?? 0);
    if (Date.now() - last < 3_600_000) return;
    window.localStorage.setItem(SCAN_KEY, String(Date.now()));
    scan.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findings = findingsQ.data ?? [];

  return (
    <SectionCard
      title="Från inkorgen"
      icon={Mailbox}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      {...(className ? { className } : {})}
      action={
        <Button size="sm" variant="ghost" onClick={() => scan.mutate()} disabled={scan.isPending}>
          <RefreshCw className={`mr-1 size-4 ${scan.isPending ? "animate-spin" : ""}`} />
          Sök i inkorgen
        </Button>
      }
    >
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Inga fynd väntar. Andrea letar efter fakturor, kortkvitton och prenumerationer i mejlen –
          allt behöver ditt godkännande innan det läggs in.
        </p>
      ) : (
        <ul className="space-y-3">
          {findings.map((row) => (
            <FindingRow key={row.id} row={row} accounts={accounts} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
