import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {

  Check,
  Cigarette,

  FileUp,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Sparkles,

  Trash2,
  Wallet,
  AlertTriangle,
  Bus,
  Car,
  Footprints,

} from "lucide-react";
import { toast } from "sonner";


import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ReceiptScanner } from "@/components/pengar/ReceiptScanner";
import { SpendPieCard } from "@/components/pengar/SpendPieCard";
import { BetsCard } from "@/components/pengar/BetsCard";
import { TransferCard } from "@/components/pengar/TransferCard";
import { LoansCard } from "@/components/pengar/LoansCard";
import { MailFindingsCard } from "@/components/pengar/MailFindingsCard";
import { IncomesCard } from "@/components/pengar/IncomesCard";
import { MonthOverviewCard } from "@/components/pengar/MonthOverviewCard";
import { MoneyHeader } from "@/components/pengar/MoneyHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildBudget,
  financeSignedUrl,
  FILE_KINDS,
  kr,
  useAccounts,
  useDeleteFinance,
  useDeleteFinanceFile,
  useFinanceFiles,
  useFixedExpenses,
  useFixedPayments,
  useIncomes,
  useSaveFinance,
  useSaveSpend,
  useDeleteSpend,
  useSpends,
  useUploadFinanceFiles,
  type AccountRow,
  type FixedExpenseRow,
  type IncomeRow,
  type SpendRow,
} from "@/lib/finance";
import {
  deleteFixedExpense,
  financeInsight,
  saveFixedExpense,
  setFixedPaid,
  syncFixedCarryOver,
} from "@/lib/finance.functions";
import {
  fixedViews,
  periodKey,
  FIXED_INTERVALS,
  intervalLabel,
  periodLabel,
  type FixedPaymentRow,
} from "@/lib/fixed-expenses";
import { useVisits } from "@/lib/db";
import { spendFlags } from "@/lib/spend-flags";
import { spendTravelMode } from "@/lib/spend-travel";
import { guessCategory, spendCategories } from "@/lib/spend-categories";
import { formatBytes } from "@/lib/vault";


export const Route = createFileRoute("/_authenticated/pengar")({
  head: () => ({
    meta: [
      { title: "Pengar – LifeHub AI" },
      {
        name: "description",
        content:
          "Saldon, nästa lön eller ersättning, fasta utgifter, utgiftsregistrering och lönespecar på ett ställe.",
      },
      { property: "og:title", content: "Pengar – LifeHub AI" },
      {
        property: "og:description",
        content: "Se hur mycket du kan göra av med per dag fram till nästa inbetalning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoneyPage,
});

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function MoneyPage() {
  const accountsQ = useAccounts();
  const incomesQ = useIncomes();
  const fixedQ = useFixedExpenses();
  const spendsQ = useSpends();
  const filesQ = useFinanceFiles();
  const paymentsQ = useFixedPayments();
  const qc = useQueryClient();

  const accounts = accountsQ.data ?? [];
  const incomes = incomesQ.data ?? [];
  const fixed = fixedQ.data ?? [];
  const spends = spendsQ.data ?? [];
  const files = filesQ.data ?? [];
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);

  const budget = useMemo(
    () => buildBudget(accounts, incomes, fixed, spends, payments),
    [accounts, incomes, fixed, spends, payments],
  );

  // Obetalda fasta utgifter från tidigare månader följer med som uppgifter.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current || !fixed.length) return;
    syncedRef.current = true;
    void syncFixedCarryOver()
      .then((res) => {
        if (res.created || res.removed) void qc.invalidateQueries({ queryKey: ["todos"] });
      })
      .catch(() => undefined);
  }, [fixed.length, qc]);

  return (
    <AppShell title="Pengar" subtitle="Inkomster, utgifter och månadens netto">
      <DataGate queries={[accountsQ, incomesQ, fixedQ, spendsQ, filesQ]}>
        <div className="space-y-4">
          <MoneyHeader budget={budget} />

          <Tabs defaultValue="oversikt">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="oversikt">Översikt</TabsTrigger>
              <TabsTrigger value="in">Inkomster</TabsTrigger>
              <TabsTrigger value="ut">Utgifter</TabsTrigger>
              <TabsTrigger value="fasta">Fasta</TabsTrigger>
              <TabsTrigger value="mer">Mer</TabsTrigger>
            </TabsList>

            <TabsContent value="oversikt" className="mt-4 grid gap-4 lg:grid-cols-2">
              <MonthOverviewCard
                spends={spends}
                incomes={incomes}
                payments={payments}
                className="lg:col-span-2"
              />
              <BudgetCard
                perDay={budget.perDay}
                days={budget.days}
                income={budget.income}
                balance={budget.balance}
                fixedLeft={budget.fixedLeft}
                spent={budget.spentThisPeriod}
              />
              <AccountsCard accounts={accounts} />
              <InsightCard perDay={budget.perDay} days={budget.days} />
              <SpendPieCard spends={spends} fixed={fixed} />
            </TabsContent>

            <TabsContent value="in" className="mt-4 grid gap-4 lg:grid-cols-2">
              <IncomesCard incomes={incomes} accounts={accounts} className="lg:col-span-2" />
              <FilesCard files={files} className="lg:col-span-2" />
            </TabsContent>

            <TabsContent value="ut" className="mt-4 grid gap-4 lg:grid-cols-2">
              <SpendCard accounts={accounts} spends={spends} />
              <ReceiptScanner accounts={accounts} spends={spends} />
              <SpendListCard accounts={accounts} spends={spends} />
              <SpendPieCard spends={spends} fixed={fixed} />
            </TabsContent>

            <TabsContent value="fasta" className="mt-4 grid gap-4 lg:grid-cols-2">
              <FixedCard expenses={fixed} payments={payments} spends={spends} />
              <LoansCard accounts={accounts} fixed={fixed} payments={payments} />
            </TabsContent>

            <TabsContent value="mer" className="mt-4 grid gap-4 lg:grid-cols-2">
              <MailFindingsCard accounts={accounts} className="lg:col-span-2" />
              <TransferCard accounts={accounts} />
              <BetsCard accounts={accounts} />
            </TabsContent>
          </Tabs>
        </div>
      </DataGate>

    </AppShell>
  );
}

function BudgetCard({
  perDay,
  days,
  income,
  balance,
  fixedLeft,
  spent,
}: {
  perDay: number;
  days: number;
  income: IncomeRow | null;
  balance: number;
  fixedLeft: number;
  spent: number;
}) {
  return (
    <SectionCard title="Dagsbudget" icon={Wallet} accent="text-nav-pengar" tint="bg-nav-pengar/12">
      <p className="text-xs text-muted-foreground">Kan göras av per dag</p>
      <p
        className={`mt-1 text-[40px] font-semibold leading-none tracking-tight tabular-nums ${
          perDay <= 0 ? "text-destructive" : "text-nav-pengar"
        }`}
      >
        {kr(perDay)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {income
          ? `${days} dagar kvar till ${income.label} den ${income.expected_on} (${kr(Number(income.amount))})`
          : "Lägg in nästa lön eller ersättning för en exakt beräkning."}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Totalt saldo", value: kr(balance) },
          { label: "Fasta kvar", value: kr(fixedLeft) },
          { label: "Spenderat i mån.", value: kr(spent) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-surface px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/** Stor inmatningsruta för hur mycket som spenderats. */
type FixedInput = {
  id?: string;
  name: string;
  amount: number;
  due_day: number;
  category: string | null;
  is_active: boolean;
  is_subscription: boolean;
  interval_months: number;
  anchor_month: number | null;
  sync_calendar: boolean;
};

function SpendCard({ accounts, spends }: { accounts: AccountRow[]; spends: SpendRow[] }) {
  const save = useSaveSpend();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [asFixed, setAsFixed] = useState(false);
  const [asSubscription, setAsSubscription] = useState(false);
  const [interval, setInterval] = useState("1");

  const makeFixed = useMutation({
    mutationFn: (values: FixedInput) => saveFixedExpense({ data: values }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Lagd som återkommande betalning i kalendern");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const categories = spendCategories(spends);
  const suggestion = guessCategory(note, spends);

  /** Kontot som snabbknapparna drar från (SEB om det finns). */
  const sebAccount =
    accounts.find((acc) => acc.name.toLowerCase().includes("seb")) ?? accounts[0] ?? null;

  function quickSpend(label: string, value: number, cat: string) {
    if (!sebAccount) {
      toast.info("Lägg till ett konto först.");
      return;
    }
    save.mutate(
      {
        values: {
          amount: value,
          note: label,
          category: cat,
          account_id: sebAccount.id,
          spent_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => toast.success(`${label} ${kr(value)} från ${sebAccount.name}`),
      },
    );
  }

  function submit() {
    const value = num(amount);
    if (!value) return;
    save.mutate(
      {
        values: {
          amount: value,
          note: note.trim() || null,
          category: (category || suggestion || "").trim() || null,
          account_id: accountId || null,
          spent_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          if (asFixed || asSubscription) {
            const months = Number(interval) || 1;
            makeFixed.mutate({
              name: note.trim() || (category || suggestion || "Återkommande betalning"),
              amount: value,
              due_day: Math.min(new Date().getDate(), 28),
              category: (category || suggestion || "").trim() || null,
              is_active: true,
              is_subscription: asSubscription,
              interval_months: months,
              anchor_month: months === 1 ? null : new Date().getMonth() + 1,
              sync_calendar: true,
            });
          }
          setAmount("");
          setNote("");
          setCategory("");
          setAsFixed(false);
          setAsSubscription(false);
          setInterval("1");
        },
      },
    );

  }


  return (
    <SectionCard title="Spenderat" icon={Receipt} accent="text-cat-viktigt" tint="bg-cat-viktigt/12">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          disabled={save.isPending}
          onClick={() => quickSpend("Cigaretter", 89, "Cigaretter")}
        >
          <Cigarette className="size-4" />
          Cigaretter 89 kr
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          {sebAccount ? `Dras från ${sebAccount.name}` : "Inget konto ännu"}
        </span>
      </div>
      <Input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        aria-label="Belopp i kronor"
        className="h-[92px] rounded-2xl text-center !text-[44px] font-semibold tabular-nums"
      />

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Vad gällde det? (valfritt)"
        className="mt-3 h-12"
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-12" aria-label="Konto">
            <SelectValue placeholder="Från konto" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name} · {kr(Number(acc.balance))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-12" aria-label="Kategori">
            <SelectValue placeholder={suggestion ?? "Kategori"} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!category && suggestion ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Andrea föreslår kategorin {suggestion}.
        </p>
      ) : null}
      <div className="mt-3 space-y-2 rounded-xl border border-border/70 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={asFixed}
            onChange={(e) => setAsFixed(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Spara som fast utgift
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={asSubscription}
            onChange={(e) => {
              setAsSubscription(e.target.checked);
              if (e.target.checked) setAsFixed(true);
            }}
            className="size-4 accent-[var(--primary)]"
          />
          Det här är en prenumeration
        </label>
        {asFixed || asSubscription ? (
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger className="h-11" aria-label="Betalningsintervall">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIXED_INTERVALS.map((item) => (
                <SelectItem key={item.value} value={String(item.value)}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <Button
        className="mt-3 h-12 w-full text-base"
        onClick={submit}
        disabled={save.isPending || !num(amount)}
      >
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Registrera utgift
      </Button>
    </SectionCard>
  );
}

/** Andreas korta analys av utgifterna. */
function InsightCard({ perDay, days }: { perDay: number; days: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await financeInsight({ data: { perDay, days } });
      setText(res.text);
    } catch (error) {
      setText(error instanceof Error ? error.message : "Kunde inte hämta analys.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Andreas ekonomikoll"
      icon={Sparkles}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
    >
      {text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Låt Andrea analysera dina utgifter och ge konkreta spartips.
        </p>
      )}
      <Button variant="outline" className="mt-3 h-11 w-full" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {text ? "Uppdatera analysen" : "Analysera mina utgifter"}
      </Button>
    </SectionCard>
  );
}


function Row({
  title,
  subtitle,
  value,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  value: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Redigera"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Ta bort"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function AccountsCard({ accounts }: { accounts: AccountRow[] }) {
  const save = useSaveFinance("finance_accounts", "Konto sparat");
  const remove = useDeleteFinance("finance_accounts", "Konto borttaget");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setBalance("");
    setOpen(true);
  }

  function openEdit(row: AccountRow) {
    setEditing(row);
    setName(row.name);
    setBalance(String(row.balance));
    setOpen(true);
  }

  function submit() {
    if (!name.trim()) return;
    save.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: name.trim(),
        balance: num(balance),
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <SectionCard
      title="Konton"
      icon={Wallet}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      count={accounts.length}
      action={
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="size-4" /> Konto
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Lägg in dina konton och saldon.</p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((row) => (
            <Row
              key={row.id}
              title={row.name}
              value={kr(Number(row.balance))}
              onEdit={() => openEdit(row)}
              onDelete={() => remove.mutate(row.id)}
            />
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ändra konto" : "Nytt konto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="acc-name">Namn</Label>
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="acc-balance">Saldo</Label>
              <Input
                id="acc-balance"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>
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

function FixedCard({
  expenses,
  payments,
  spends,
}: {
  expenses: FixedExpenseRow[];
  payments: FixedPaymentRow[];
  spends: SpendRow[];
}) {

  const qc = useQueryClient();
  const setPaid = useMutation({
    mutationFn: (vars: { expenseId: string; period: string; paid: boolean }) =>
      setFixedPaid({ data: vars }),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ["fixed_expense_payments"] });
      void qc.invalidateQueries({ queryKey: ["todos"] });
      toast.success(vars.paid ? "Markerad som betald" : "Betalning ångrad");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const period = periodKey();
  const views = useMemo(() => fixedViews(expenses, payments), [expenses, payments]);
  const paidCount = views.filter((v) => v.row.is_active && v.status === "betald").length;
  const activeCount = views.filter((v) => v.row.is_active).length;

  const save = useMutation({
    mutationFn: (values: FixedInput) => saveFixedExpense({ data: values }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Fast utgift sparad");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFixedExpense({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Fast utgift borttagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpenseRow | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("25");
  const [category, setCategory] = useState("");
  const [subscription, setSubscription] = useState(false);
  const [interval, setInterval] = useState("1");
  const [syncCal, setSyncCal] = useState(true);

  const categories = spendCategories(spends);

  const total = expenses
    .filter((e) => e.is_active)
    .reduce(
      (sum, e) => sum + Number(e.amount) / Math.max(Number(e.interval_months ?? 1) || 1, 1),
      0,
    );

  function openNew() {
    setEditing(null);
    setName("");
    setAmount("");
    setDay("25");
    setCategory("");
    setSubscription(false);
    setInterval("1");
    setSyncCal(true);
    setOpen(true);
  }

  function openEdit(row: FixedExpenseRow) {
    setEditing(row);
    setName(row.name);
    setAmount(String(row.amount));
    setDay(String(row.due_day));
    setCategory(row.category ?? "");
    setSubscription(Boolean(row.is_subscription));
    setInterval(String(row.interval_months ?? 1));
    setSyncCal(row.sync_calendar !== false);
    setOpen(true);
  }

  function submit() {
    if (!name.trim()) return;
    const parsedDay = Math.min(Math.max(Number(day) || 1, 1), 28);
    const months = Number(interval) || 1;
    save.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: name.trim(),
        amount: num(amount),
        due_day: parsedDay,
        category: category.trim() || null,
        is_active: editing?.is_active ?? true,
        is_subscription: subscription,
        interval_months: months,
        anchor_month:
          months === 1
            ? null
            : (editing?.anchor_month ?? new Date().getMonth() + 1),
        sync_calendar: syncCal,
      },
      { onSuccess: () => setOpen(false) },
    );
  }


  return (
    <SectionCard
      title="Fasta utgifter"
      icon={Repeat}
      accent="text-nav-jurist"
      tint="bg-nav-jurist/12"
      count={expenses.length}
      action={
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="size-4" /> Ny
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {paidCount} av {activeCount} betalda denna månad · totalt {kr(total)} per månad
      </p>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Lägg in hyra, el, bredband och liknande.</p>
      ) : (
        <ul className="space-y-2">
          {views.map(({ row, status, carryOver, nextPeriod }) => (
            <li
              key={row.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                status === "forsenad" || carryOver.length
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border/70"
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={status === "betald"}
                aria-label={`Markera ${row.name} som betald`}
                disabled={setPaid.isPending}
                onClick={() =>
                  setPaid.mutate({
                    expenseId: row.id,
                    period,
                    paid: status !== "betald",
                  })
                }
                className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  status === "betald"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent hover:border-primary"
                }`}
              >
                <Check className="size-4" />
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`flex items-center gap-1.5 truncate text-sm font-medium ${
                    status === "betald" ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  <span className="truncate">{row.name}</span>
                  {row.is_subscription ? (
                    <span className="shrink-0 rounded-full bg-cat-ekonomi/15 px-1.5 py-0.5 text-[10px] font-medium text-cat-ekonomi">
                      Prenumeration
                    </span>
                  ) : null}
                </p>
                <p
                  className={`text-xs ${
                    status === "forsenad" ? "font-medium text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {status === "betald"
                    ? "Betald denna månad"
                    : status === "vilande"
                      ? `${intervalLabel(Number(row.interval_months ?? 1))} · nästa ${periodLabel(nextPeriod)}`
                      : status === "forsenad"
                        ? `Förfallen den ${row.due_day}:e`
                        : `Dras den ${row.due_day}:e`}
                  {row.category ? ` · ${row.category}` : ""}
                  {carryOver.length
                    ? ` · ${carryOver.length} obetald${carryOver.length > 1 ? "a" : ""} månad${
                        carryOver.length > 1 ? "er" : ""
                      } (${carryOver.map(periodLabel).join(", ")})`
                    : ""}
                </p>
              </div>


              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {kr(Number(row.amount))}
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
                onClick={() => remove.mutate(row.id)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ändra fast utgift" : "Ny fast utgift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fix-name">Namn</Label>
              <Input id="fix-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fix-amount">Belopp per betalning</Label>
                <Input
                  id="fix-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fix-day">Förfallodag (1–28)</Label>
                <Input
                  id="fix-day"
                  inputMode="numeric"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11" aria-label="Kategori">
                    <SelectValue placeholder="Välj kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Intervall</Label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger className="h-11" aria-label="Intervall">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIXED_INTERVALS.map((item) => (
                      <SelectItem key={item.value} value={String(item.value)}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={subscription}
                onChange={(e) => setSubscription(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Det här är en prenumeration
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={syncCal}
                onChange={(e) => setSyncCal(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Visa återkommande betalningar i kalendern
            </label>
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

function SpendListCard({ accounts, spends: all }: { accounts: AccountRow[]; spends: SpendRow[] }) {
  const remove = useDeleteSpend();
  const save = useSaveSpend("Utgift uppdaterad");
  const [edit, setEdit] = useState<SpendRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");

  const visits = useVisits().data ?? [];
  const spends = all.slice(0, 20);
  const categories = spendCategories(all);

  function open(row: SpendRow) {
    setEdit(row);
    setAmount(String(Number(row.amount)));
    setNote(row.note ?? "");
    setCategory(row.category ?? "");
    setAccountId(row.account_id ?? "");
    setDate(row.spent_at.slice(0, 10));
  }

  function submit() {
    if (!edit) return;
    const value = num(amount);
    if (!value) return;
    save.mutate(
      {
        values: {
          id: edit.id,
          amount: value,
          note: note.trim() || null,
          category: category.trim() || null,
          account_id: accountId || null,
          spent_at: new Date(`${date}T12:00:00`).toISOString(),
        },
        previous: edit,
      },
      { onSuccess: () => setEdit(null) },
    );
  }

  return (
    <SectionCard
      title="Senaste utgifter"
      icon={Receipt}
      accent="text-cat-viktigt"
      tint="bg-cat-viktigt/12"
      count={spends.length}
    >
      {spends.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga registrerade utgifter ännu.</p>
      ) : (
        <ul className="space-y-2">
          {spends.map((row) => {
            const account = accounts.find((acc) => acc.id === row.account_id);
            const flags = spendFlags(row, all);
            const travel = spendTravelMode(row.spent_at, visits);
            const TravelIcon =
              travel?.mode === "kollektivt" ? Bus : travel?.mode === "gang_cykel" ? Footprints : Car;
            return (

              <li
                key={row.id}
                className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.note ?? "Utgift"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(row.spent_at).toLocaleString("sv-SE", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {row.category ? ` · ${row.category}` : ""}
                    {account ? ` · ${account.name}` : ""}
                  </p>
                  {flags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {flags.map((flag) => (
                        <span
                          key={flag.id}
                          title={flag.hint}
                          className={
                            flag.level === "hog"
                              ? "inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-medium text-destructive"
                              : "inline-flex items-center gap-1 rounded-full bg-cat-viktigt/12 px-2 py-0.5 text-[11px] font-medium text-cat-viktigt"
                          }
                        >
                          <AlertTriangle className="size-3" />
                          {flag.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span
                  title={travel ? travel.hint : "Ingen resa hittad kring köpet"}
                  className={
                    travel
                      ? "flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"
                      : "flex shrink-0 items-center gap-1 text-xs text-muted-foreground/50"
                  }
                >

                  <TravelIcon className="size-3.5" />
                  {travel ? travel.label : "–"}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {kr(Number(row.amount))}
                </span>


                <button
                  type="button"
                  onClick={() => open(row)}
                  aria-label="Redigera"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(row)}
                  aria-label="Ta bort"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(edit)} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera utgift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-amount">Belopp</Label>
                <Input
                  id="ed-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ed-date">Datum</Label>
                <Input
                  id="ed-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ed-note">Beskrivning</Label>
              <Input id="ed-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([category, ...categories].filter(Boolean))].map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Konto</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
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


function FilesCard({
  files,
  className,
}: {
  files: ReturnType<typeof useFinanceFiles>["data"] extends (infer T)[] | undefined
    ? T[]
    : never[];
  className?: string;
}) {
  const upload = useUploadFinanceFiles();
  const remove = useDeleteFinanceFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("lonespec");
  const [caption, setCaption] = useState("");

  async function openFile(path: string) {
    try {
      window.open(await financeSignedUrl(path), "_blank", "noopener");
    } catch {
      /* toast hanteras i mutationerna */
    }
  }

  return (
    <SectionCard
      title="Dokument"
      icon={FileUp}
      accent="text-nav-kassaskap"
      tint="bg-nav-kassaskap/12"
      count={files.length}
      {...(className ? { className } : {})}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label>Typ</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILE_KINDS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileUp className="size-4" />
          )}
          Ladda upp
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            if (list.length) upload.mutate({ files: list, kind });
            e.target.value = "";
          }}
        />
      </div>

      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Anteckning om inbetalningar (sparas lokalt i vyn)"
        className="mt-3 min-h-[64px]"
      />

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Ladda upp lönespecar, fakturor och underlag för inbetalningar.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => openFile(file.storage_path)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium hover:text-primary">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {FILE_KINDS.find((k) => k.value === file.kind)?.label ?? file.kind} ·{" "}
                  {formatBytes(file.size_bytes)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(file)}
                aria-label="Ta bort fil"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
