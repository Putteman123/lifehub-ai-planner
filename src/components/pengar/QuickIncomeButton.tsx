import { useState } from "react";
import { Loader2, Sparkle } from "lucide-react";

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
import { kr, useSaveIncome, type AccountRow } from "@/lib/finance";

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Snabbregistrering av en extra inkomst som direkt bokförs på ett konto. */
export function QuickIncomeButton({
  accounts,
  size = "sm",
}: {
  accounts: AccountRow[];
  size?: "sm" | "default";
}) {
  const save = useSaveIncome("Extra inkomst bokförd");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  function submit() {
    const value = num(amount);
    if (!value || !label.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    save.mutate(
      {
        values: {
          label: label.trim(),
          amount: value,
          expected_on: today,
          received_on: today,
          kind: "extra",
          is_received: true,
          account_id: accountId || null,
        },
      },
      {
        onSuccess: () => {
          setLabel("");
          setAmount("");
          setOpen(false);
        },
      },
    );
  }

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        <Sparkle className="size-4" /> Extra inkomst
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extra inkomst</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="qi-label">Vad gällde det?</Label>
              <Input
                id="qi-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Såld pryl, swish, återbetalning…"
              />
            </div>
            <div>
              <Label htmlFor="qi-amount">Belopp</Label>
              <Input
                id="qi-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 text-center !text-[28px] font-semibold tabular-nums"
              />
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
                      {acc.name} · {kr(Number(acc.balance))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Beloppet läggs till på kontot direkt, med dagens datum.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={save.isPending || !num(amount)}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Bokför
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
