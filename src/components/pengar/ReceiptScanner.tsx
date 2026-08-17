import { useRef, useState } from "react";
import { CalendarPlus, Camera, Loader2, MapPin, ScanLine, ShoppingCart, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { analyzeReceipt, logReceiptEvent, logReceiptVisit } from "@/lib/finance.functions";
import { analyzeDaySegments } from "@/lib/day-mapping.functions";

import { kr, useSaveSpend, useUploadFinanceFiles, type AccountRow, type SpendRow } from "@/lib/finance";
import { spendCategories } from "@/lib/spend-categories";
import { useAddPantryItems } from "@/lib/shopping";


type Read = Awaited<ReturnType<typeof analyzeReceipt>>;

/** Skalar ner bilden så uppladdning och AI-analys går snabbt. */
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
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunde inte bearbeta bilden.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ReceiptScanner({
  accounts,
  spends,
}: {
  accounts: AccountRow[];
  spends: SpendRow[];
}) {
  const upload = useUploadFinanceFiles();
  const saveSpend = useSaveSpend();
  const addPantry = useAddPantryItems();

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [markMap, setMarkMap] = useState(true);
  const [addEvent, setAddEvent] = useState(true);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [splitTobacco, setSplitTobacco] = useState(true);

  const categories = spendCategories(spends);

  /** Tobaksrader summerade per kategori (Cigaretter/Snus). */
  const tobaccoSplits: { category: "Cigaretter" | "Snus"; amount: number; names: string[] }[] =
    Object.values(
      (read?.tobacco ?? []).reduce<
        Record<string, { category: "Cigaretter" | "Snus"; amount: number; names: string[] }>
      >((acc, item) => {
        const key = item.category;
        const row = acc[key] ?? { category: item.category, amount: 0, names: [] };
        row.amount += item.amount ?? 0;
        row.names.push(item.name);
        acc[key] = row;
        return acc;
      }, {}),
    ).filter((row) => row.amount > 0);


  async function handleFile(file: File) {
    setBusy(true);
    try {
      const dataUrl = await toDataUrl(file);
      const result = await analyzeReceipt({
        data: { dataUrl, mimeType: file.type || "image/jpeg", fileName: file.name },
      });
      setRead(result);
      setAmount(result.total ? String(result.total) : "");
      setNote(result.merchant ?? "");
      setDate(result.date ?? new Date().toISOString().slice(0, 10));
      setTime(result.time ?? "");
      setAddress(result.address ?? "");
      setMarkMap(result.kind !== "faktura");
      setCategory(result.category ?? "");
      setPicked(new Set(result.groceries.map((item) => item.name)));
      upload.mutate({ files: [file], kind: result.kind === "faktura" ? "faktura" : "kvitto" });
      toast.success("Andrea läste av kvittot");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRead(null);
    setAmount("");
    setNote("");
    setTime("");
    setAddress("");
    setCategory("");
    setPicked(new Set());
  }

  async function save() {
    const value = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Ange ett belopp.");
      return;
    }
    const clock = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "12:00";
    const spentAt = date
      ? new Date(`${date}T${clock}:00`).toISOString()
      : new Date().toISOString();
    const merchant = note.trim();

    // Tobak bokförs som egna poster (Cigaretter/Snus) skilt från maten.
    const splits = splitTobacco ? tobaccoSplits : [];
    const splitSum = splits.reduce((sum, row) => sum + row.amount, 0);
    const mainAmount = splitSum > 0 && splitSum < value ? value - splitSum : value;

    saveSpend.mutate(
      {
        values: {
          amount: mainAmount,
          note: merchant || null,
          category: category.trim() || null,
          account_id: accountId || null,
          spent_at: spentAt,
        },
      },
      {

        onSuccess: async () => {
          for (const row of splits) {
            await saveSpend.mutateAsync({
              values: {
                amount: row.amount,
                note: `${row.category}${merchant ? ` – ${merchant}` : ""}`,
                category: row.category,
                account_id: accountId || null,
                spent_at: spentAt,
              },
            });
          }
          if (splits.length) {
            toast.success(
              `Tobak bokförd separat: ${splits.map((r) => r.category).join(" och ")}`,
            );
          }
          const names = [...picked];
          if (names.length) {
            await addPantry.mutateAsync({ names, purchasedAt: spentAt });
            toast.success(`${names.length} varor sparades i Skafferiet`);
          }

          if (markMap && merchant) {
            try {
              const res = await logReceiptVisit({
                data: {
                  merchant,
                  address: address.trim() || undefined,
                  spentAt,
                  amount: value,
                },
              });
              if (res.ok) toast.success(res.message);
              else toast.info(res.message);

              if (res.ok) {
                // Uppdatera "Min dag" så att butiksstoppet kommer med direkt.
                const day = new Date(spentAt).toLocaleDateString("sv-SE", {
                  timeZone: "Europe/Stockholm",
                });
                try {
                  await analyzeDaySegments({ data: { day } });
                } catch {
                  // Dagskartläggningen kan sakna GPS-data – besöket finns ändå på kartan.
                }
                void queryClient.invalidateQueries({ queryKey: ["day_segments", day] });
                void queryClient.invalidateQueries({ queryKey: ["visits"] });
              }
            } catch {
              toast.info("Kunde inte markera butiken på kartan.");
            }
          }

          if (addEvent && (date || merchant || address.trim())) {
            try {
              const res = await logReceiptEvent({
                data: {
                  merchant: merchant || undefined,
                  address: address.trim() || undefined,
                  spentAt,
                  amount: value,
                  category: category.trim() || undefined,
                },
              });
              if (res.ok) toast.success(res.message);
            } catch {
              toast.info("Kunde inte lägga till kvittot i kalendern.");
            }
            void queryClient.invalidateQueries({ queryKey: ["events"] });
          }

          reset();
        },
      },
    );
  }


  return (
    <SectionCard
      title="Kvitto & faktura"
      icon={ScanLine}
      accent="text-nav-handla"
      tint="bg-nav-handla/12"
    >
      <p className="text-sm text-muted-foreground">
        Fotografera eller ladda upp – Andrea läser belopp, kategori och dagligvaror.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          Fotografera
        </Button>
        <Button
          variant="outline"
          className="h-12"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" /> Ladda upp
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {read ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-surface p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-nav-handla" />
            {read.merchant ?? "Kvitto"} {read.total ? `· ${kr(read.total)}` : ""}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rec-amount">Belopp</Label>
              <Input
                id="rec-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rec-date">Datum</Label>
              <Input
                id="rec-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rec-note">Beskrivning</Label>
            <Input id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div>
              <Label htmlFor="rec-address">Butikens adress</Label>
              <Input
                id="rec-address"
                value={address}
                placeholder="Adress från kvittot"
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rec-time">Klockslag</Label>
              <Input
                id="rec-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-nav-handla" />
              Markera butiken som besök på kartan
            </span>
            <Switch checked={markMap} onCheckedChange={setMarkMap} />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <CalendarPlus className="size-4 text-nav-kalender" />
              Lägg in köpet i kalendern
            </span>
            <Switch checked={addEvent} onCheckedChange={setAddEvent} />
          </label>




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

          {tobaccoSplits.length > 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Cigarette className="size-3.5" /> Tobak hittad – bokförs separat
                </p>
                <Switch checked={splitTobacco} onCheckedChange={setSplitTobacco} />
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {tobaccoSplits.map((row) => (
                  <li key={row.category} className="flex justify-between tabular-nums">
                    <span>
                      {row.category} · {row.names.join(", ")}
                    </span>
                    <span>{Math.round(row.amount)} kr</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {read.groceries.length > 0 ? (

            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ShoppingCart className="size-3.5" /> Dagligvaror till Skafferiet – tryck för att välja
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {read.groceries.map((item) => {
                  const on = picked.has(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(item.name);
                          else next.add(item.name);
                          return next;
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        on
                          ? "bg-nav-handla text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.name}
                      {item.quantity ? ` · ${item.quantity}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={save} disabled={saveSpend.isPending}>
              {saveSpend.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Spara utgift
            </Button>
            <Button variant="ghost" className="h-11" onClick={reset}>
              Avbryt
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
