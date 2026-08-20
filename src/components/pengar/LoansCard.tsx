import { useState } from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
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
import { kr, type AccountRow, type FixedExpenseRow } from "@/lib/finance";
import type { FixedPaymentRow } from "@/lib/fixed-expenses";
import { loanPaidTotal, useDeleteLoan, useLoans, useSaveLoan, type LoanRow } from "@/lib/loans";

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Lån du tagit: inbetalning när det kom in, amortering + ränta varje månad. */
export function LoansCard({
  accounts,
  fixed,
  payments,
}: {
  accounts: AccountRow[];
  fixed: FixedExpenseRow[];
  payments: FixedPaymentRow[];
}) {
  const loansQ = useLoans();
  const save = useSaveLoan();
  const remove = useDeleteLoan();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LoanRow | null>(null);
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  const [monthly, setMonthly] = useState("");
  const [interest, setInterest] = useState("");
  const [dueDay, setDueDay] = useState("27");

  const loans = loansQ.data ?? [];

  function openNew() {
    setEditing(null);
    setName("");
    setPrincipal("");
    setDate(new Date().toISOString().slice(0, 10));
    setAccountId(accounts[0]?.id ?? "");
    setMonthly("");
    setInterest("");
    setDueDay("27");
    setOpen(true);
  }

  function openEdit(row: LoanRow) {
    setEditing(row);
    setName(row.name);
    setPrincipal(String(row.principal));
    setDate(row.disbursed_on);
    setAccountId(row.account_id ?? "");
    setMonthly(String(row.monthly_payment));
    setInterest(String(row.monthly_interest));
    setDueDay(String(row.due_day));
    setOpen(true);
  }

  function submit() {
    save.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name,
        principal: num(principal),
        disbursed_on: date,
        account_id: accountId || null,
        monthly_payment: num(monthly),
        monthly_interest: num(interest),
        due_day: num(dueDay) || 27,
        is_active: editing?.is_active ?? true,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <SectionCard
      title="Lån"
      icon={Landmark}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      count={loans.length}
      action={
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="size-4" /> Nytt lån
        </Button>
      }
    >
      {loans.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Lägg in ett lån du tagit. Lånebeloppet hamnar som inbetalning och amortering samt ränta
          läggs som två fasta utgifter varje månad.
        </p>
      ) : (
        <ul className="space-y-2">
          {loans.map((row) => {
            const paid = loanPaidTotal(row.id, fixed, payments);
            return (
              <li key={row.id} className="rounded-2xl bg-surface px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {kr(Number(row.principal))}
                  </span>
                  <button
                    type="button"
                    aria-label="Ändra lån"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Ta bort lån"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Amortering {kr(Number(row.monthly_payment))}/mån · ränta{" "}
                  <span className="text-destructive">{kr(Number(row.monthly_interest))}/mån</span> ·
                  förfaller den {row.due_day}
                </p>
                <p className="text-xs text-muted-foreground">
                  Utbetalt {row.disbursed_on} · betalt hittills {kr(paid)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ändra lån" : "Nytt lån"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="loan-name">Namn</Label>
              <Input
                id="loan-name"
                placeholder="Billån SEB"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loan-principal">Lånebelopp</Label>
                <Input
                  id="loan-principal"
                  inputMode="decimal"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="loan-date">Utbetalat</Label>
                <Input
                  id="loan-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Konto pengarna kom in på</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj konto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="loan-monthly">Amortering/mån</Label>
                <Input
                  id="loan-monthly"
                  inputMode="decimal"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="loan-interest">Ränta/mån</Label>
                <Input
                  id="loan-interest"
                  inputMode="decimal"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="loan-due">Förfallodag</Label>
                <Input
                  id="loan-due"
                  inputMode="numeric"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Amortering och ränta läggs som två separata fasta utgifter så att du kan bocka av dem
              varje månad.
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
