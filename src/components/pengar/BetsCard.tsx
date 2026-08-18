import { useRef, useState } from "react";
import { Camera, Dices, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { analyzeBetSlip } from "@/lib/finance.functions";
import { FINANCE_BUCKET, kr, type AccountRow } from "@/lib/finance";
import {
  BET_ACCOUNT_NAME,
  GAME_TYPES,
  betStatusLabel,
  betSummary,
  useBets,
  useDeleteBet,
  useSaveBet,
  useSettleBet,
  type BetRow,
} from "@/lib/bets";

function num(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Skalar ner kupongbilden så AI-analysen går snabbt. */
async function toDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Kunde inte läsa filen."));
      reader.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunde inte bearbeta bilden.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const RANGES = [
  { value: 30, label: "30 dagar" },
  { value: 90, label: "3 mån" },
  { value: 365, label: "12 mån" },
];

/** Spel på ATG-kontot: fota kupongen, låt AI tolka och rätta utfallet manuellt. */
export function BetsCard({ accounts }: { accounts: AccountRow[] }) {
  const betsQ = useBets();
  const save = useSaveBet();
  const settle = useSettleBet();
  const remove = useDeleteBet();

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [payouts, setPayouts] = useState<Record<string, string>>({});

  const atg = accounts.find((a) => a.name.toLowerCase() === BET_ACCOUNT_NAME.toLowerCase());
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [track, setTrack] = useState("");
  const [gameType, setGameType] = useState("V75");
  const [rows, setRows] = useState("1");
  const [stake, setStake] = useState("");
  const [accountId, setAccountId] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);

  const bets = betsQ.data ?? [];
  const summary = betSummary(bets, days);

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setTrack("");
    setGameType("V75");
    setRows("1");
    setStake("");
    setReceiptPath(null);
    setAccountId(atg?.id ?? accounts[0]?.id ?? "");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await toDataUrl(file);
      const read = await analyzeBetSlip({
        data: {
          dataUrl,
          mimeType: file.type || "image/jpeg",
          fileName: file.name || "kupong",
        },
      });

      // Spara kupongbilden i ekonomi-lagringen.
      const { data: user } = await supabase.auth.getUser();
      let path: string | null = null;
      if (user.user) {
        const safeName = (file.name || "kupong.jpg").replace(/[^\w.\-]+/g, "_");
        path = `${user.user.id}/spel/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from(FINANCE_BUCKET)
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (error) path = null;
      }

      resetForm();
      if (read.date) setDate(read.date);
      if (read.track) setTrack(read.track);
      if (read.gameType) setGameType(read.gameType);
      if (read.rows) setRows(String(read.rows));
      if (read.stake) setStake(String(read.stake));
      setReceiptPath(path);
      setOpen(true);
      toast.success("Kupongen är tolkad – kontrollera uppgifterna.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    save.mutate(
      {
        bet_date: date,
        track,
        game_type: gameType,
        rows_count: Math.max(1, Math.round(num(rows))),
        stake: num(stake),
        account_id: accountId || atg?.id || null,
        receipt_path: receiptPath,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  function settleBet(bet: BetRow) {
    const value = num(payouts[bet.id] ?? "");
    settle.mutate(
      { bet, payout: value },
      { onSuccess: () => setPayouts((p) => ({ ...p, [bet.id]: "" })) },
    );
  }

  return (
    <SectionCard
      title="Spel (ATG)"
      icon={Dices}
      accent="text-cat-iptv"
      tint="bg-cat-iptv/12"
      count={bets.length}
      action={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                days === r.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Insats", value: kr(summary.stake) },
          { label: "Vinst", value: kr(summary.payout) },
          { label: "Netto", value: kr(summary.net) },
          { label: "Träff", value: `${summary.hitRate} %` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-surface px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p
              className={`mt-0.5 text-sm font-semibold tabular-nums ${
                item.label === "Netto" && summary.net < 0 ? "text-destructive" : ""
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          Fota kupong
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Ladda upp
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          Lägg till manuellt
        </Button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {bets.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Fota en kupong så läser Andrea av spelform, rader och insats.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {bets.slice(0, 20).map((bet) => (
            <li key={bet.id} className="rounded-2xl bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {bet.game_type}
                    {bet.track ? ` · ${bet.track}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bet.bet_date} · {bet.rows_count} rader · insats {kr(Number(bet.stake))} ·{" "}
                    {betStatusLabel(bet.status)}
                    {Number(bet.payout) > 0 ? ` ${kr(Number(bet.payout))}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Ta bort spel"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(bet)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {bet.status === "oavgjort" ? (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Vinst i kr (0 = förlorat)"
                    className="h-9"
                    value={payouts[bet.id] ?? ""}
                    onChange={(e) => setPayouts((p) => ({ ...p, [bet.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" onClick={() => settleBet(bet)}>
                    Rätta
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nytt spel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bet-date">Datum</Label>
                <Input
                  id="bet-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="bet-track">Bana</Label>
                <Input
                  id="bet-track"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  placeholder="Solvalla"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Spelform</Label>
                <Select value={gameType} onValueChange={setGameType}>
                  <SelectTrigger aria-label="Spelform">
                    <SelectValue placeholder="Spelform" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([gameType, ...GAME_TYPES])].filter(Boolean).map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bet-rows">Rader</Label>
                <Input
                  id="bet-rows"
                  inputMode="numeric"
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bet-stake">Insats (kr)</Label>
                <Input
                  id="bet-stake"
                  inputMode="decimal"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
              </div>
              <div>
                <Label>Konto</Label>
                <Select value={accountId || atg?.id || ""} onValueChange={setAccountId}>
                  <SelectTrigger aria-label="Konto">
                    <SelectValue placeholder="Konto" />
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
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={save.isPending}>
              Spara spel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
