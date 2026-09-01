import { useState } from "react";
import { Check, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickIncomeButton } from "@/components/pengar/QuickIncomeButton";
import {
  incomeDate,
  INCOME_KINDS,
  kr,
  useDeleteIncome,
  useSaveIncome,
  useSetIncomeReceived,
  type AccountRow,
  type IncomeRow,
} from "@/lib/finance";

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Inbetalningar bokförs som utgifter: markeras de som inkomna läggs beloppet
 * till på valt konto.
 */
export function IncomesCard({
  incomes,
  accounts,
  className,
}: {
  incomes: IncomeRow[];
  accounts: AccountRow[];
  className?: string;
}) {
  const save = useSaveIncome();
  const remove = useDeleteIncome();
  const setReceived = useSetIncomeReceived();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("lon");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  const pending = incomes.filter((row) => !row.is_received);
  const received = [...incomes]
    .filter((row) => row.is_received)
    .sort((a, b) => incomeDate(b).localeCompare(incomeDate(a)));

  function openNew() {
    setEditing(null);
    setLabel("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setKind("lon");
    setAccountId(accounts[0]?.id ?? "");
    setNote("");
    setOpen(true);
  }

  function openEdit(row: IncomeRow) {
    setEditing(row);
    setLabel(row.label);
    setAmount(String(Number(row.amount)));
    setDate(row.expected_on);
    setKind(row.kind);
    setAccountId(row.account_id ?? "");
    setNote(row.note ?? "");
    setOpen(true);
  }

  function submit() {
    if (!label.trim() || !date) return;
    save.mutate(
      {
        values: {
          ...(editing ? { id: editing.id } : {}),
          label: label.trim(),
          amount: num(amount),
          expected_on: date,
          kind,
          is_received: editing?.is_received ?? false,
          received_on: editing?.received_on ?? null,
          account_id: accountId || null,
          note: note.trim() || null,
        },
        previous: editing,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  function renderRow(row: IncomeRow) {
    const account = accounts.find((acc) => acc.id === row.account_id);
    return (
      <li key={row.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={row.is_received}
          aria-label={`Markera ${row.label} som inkommen`}
          disabled={setReceived.isPending}
          onClick={() => setReceived.mutate({ row, received: !row.is_received })}
          className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            row.is_received
              ? "border-cat-ledig bg-cat-ledig text-background"
              : "border-border bg-background text-transparent hover:border-cat-ledig"
          }`}
        >
          <Check className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.is_received ? `Inkom ${incomeDate(row)}` : `Väntas ${row.expected_on}`}
            {` · ${INCOME_KINDS.find((k) => k.value === row.kind)?.label ?? row.kind}`}
            {account ? ` · ${account.name}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            row.is_received ? "text-cat-ledig" : ""
          }`}
        >
          +{kr(Number(row.amount))}
        </span>
        <button
          type="button"
          aria-label="Redigera"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => openEdit(row)}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Ta bort"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => remove.mutate(row)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </li>
    );
  }

  return (
    <SectionCard
      title="Inbetalningar"
      icon={CalendarClock}
      accent="text-cat-ledig"
      tint="bg-cat-ledig/12"
      count={incomes.length}
      {...(className ? { className } : {})}
      action={
        <div className="flex gap-2">
          <QuickIncomeButton accounts={accounts} />
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="size-4" /> Ny
          </Button>
        </div>
      }
    >
      {incomes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Lägg in lön, ersättning eller en extra inkomst så räknas den med i månadsbilden.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Kommande ({pending.length})
            </p>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inget inplanerat just nu.</p>
            ) : (
              <ul className="space-y-2">{pending.map(renderRow)}</ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Bokförda ({received.length})
            </p>
            {received.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inget bokfört ännu.</p>
            ) : (
              <ul className="space-y-2">{received.slice(0, 12).map(renderRow)}</ul>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ändra inbetalning" : "Ny inbetalning"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="inc-label">Namn</Label>
              <Input id="inc-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inc-amount">Belopp</Label>
                <Input
                  id="inc-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="inc-date">Datum</Label>
                <Input
                  id="inc-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_KINDS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Till konto</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Välj konto" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="inc-note">Anteckning</Label>
              <Input id="inc-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Saldot ändras först när du markerar inbetalningen som inkommen.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={save.isPending}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
