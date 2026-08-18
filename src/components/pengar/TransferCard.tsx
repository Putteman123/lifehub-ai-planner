import { useState } from "react";
import { ArrowLeftRight, Undo2 } from "lucide-react";

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
import { kr, type AccountRow } from "@/lib/finance";
import { useSaveTransfer, useTransfers, useUndoTransfer } from "@/lib/transfers";

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Överföringar mellan konton, med historik och ångra. */
export function TransferCard({ accounts }: { accounts: AccountRow[] }) {
  const transfersQ = useTransfers();
  const save = useSaveTransfer();
  const undo = useUndoTransfer();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const transfers = transfersQ.data ?? [];
  const name = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "Borttaget konto";

  function submit() {
    save.mutate(
      { from_account_id: from, to_account_id: to, amount: num(amount), note },
      {
        onSuccess: () => {
          setOpen(false);
          setAmount("");
          setNote("");
        },
      },
    );
  }

  return (
    <SectionCard
      title="Överföringar"
      icon={ArrowLeftRight}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      count={transfers.length}
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={accounts.length < 2}
          onClick={() => {
            setFrom(accounts[0]?.id ?? "");
            setTo(accounts[1]?.id ?? "");
            setOpen(true);
          }}
        >
          <ArrowLeftRight className="size-4" /> Överför
        </Button>
      }
    >
      <ul className="space-y-2">
        {accounts.map((acc) => (
          <li
            key={acc.id}
            className="flex items-center justify-between rounded-2xl bg-surface px-3 py-2 text-sm"
          >
            <span className="truncate">{acc.name}</span>
            <span className="shrink-0 font-semibold tabular-nums">{kr(Number(acc.balance))}</span>
          </li>
        ))}
      </ul>

      {transfers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Inga överföringar ännu. Flytta pengar mellan dina konton med knappen ovan.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3">
          {transfers.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {name(row.from_account_id)} → {name(row.to_account_id)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {row.transferred_at.slice(0, 10)}
                  {row.note ? ` · ${row.note}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{kr(Number(row.amount))}</span>
              <button
                type="button"
                aria-label="Ångra överföring"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => undo.mutate(row)}
              >
                <Undo2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Överför mellan konton</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Från</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger aria-label="Från konto">
                  <SelectValue placeholder="Välj konto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {kr(Number(a.balance))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Till</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger aria-label="Till konto">
                  <SelectValue placeholder="Välj konto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {kr(Number(a.balance))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tr-amount">Belopp</Label>
              <Input
                id="tr-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tr-note">Notering</Label>
              <Input id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={save.isPending}>
              Överför
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
