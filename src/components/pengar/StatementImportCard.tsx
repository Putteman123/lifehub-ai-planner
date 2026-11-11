import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { kr, type AccountRow } from "@/lib/finance";
import { classifyStatement, type ClassifiedRow } from "@/lib/statement-import.functions";
import {
  findDuplicate, findTransferPair, parseTable, shouldAutoSave, splitCsv,
  type Bank, type ExistingRow, type StatementRow,
} from "@/lib/statement-parse";

type Review = ClassifiedRow & { reason: string };
const LABEL: Record<string, string> = {
  perplexity: "Perplexity (Gemini)", google: "din Gemini-nyckel", lovable: "Google Gemini", openai: "ChatGPT",
};

async function imageToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return { mimeType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "" };
}

async function readFile(file: File): Promise<{ bank: Bank; rows: StatementRow[]; rawText?: string; image?: { mimeType: string; data: string } }> {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/.test(name)) {
    const bank: Bank = /revolut/.test(name) ? "revolut" : /seb/.test(name) ? "seb" : "okänd";
    return { bank, rows: [], image: await imageToBase64(file) };
  }
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    for (let p = 1; p <= Math.min(doc.numPages, 15); p++) {
      const page = await doc.getPage(p);
      const c = await page.getTextContent();
      text += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    }
    const bank: Bank = /revolut/i.test(text) ? "revolut" : /seb|skandinaviska/i.test(text) ? "seb" : "okänd";
    return { bank, rows: [], rawText: text.slice(0, 60000) };
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) return { bank: "okänd", rows: [] };
    const table = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][]).map((r) => r.map((c) => String(c ?? "")));
    return parseTable(table, file.name);
  }
  return parseTable(splitCsv(await file.text()), file.name);
}

/** Läser in kontoutdrag från SEB/Revolut, sorterar via AI och hoppar över dubbletter. */
export function StatementImportCard({ accounts }: { accounts: AccountRow[] }) {
  const classify = useServerFn(classifyStatement);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [review, setReview] = useState<Review[]>([]);
  const [ctx, setCtx] = useState<{ accountId: string | null; userId: string } | null>(null);

  const accountFor = (name: string | null | undefined) =>
    name ? accounts.find((a) => a.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(a.name.toLowerCase()))?.id ?? null : null;

  async function saveRow(r: ClassifiedRow, accountId: string | null, userId: string) {
    const note = r.text || null;
    if (r.kind === "transfer") {
      const other = accountFor(r.other_account);
      const out = r.amount < 0;
      const { error } = await supabase.from("account_transfers").insert({
        user_id: userId, amount: Math.abs(r.amount), note,
        from_account_id: out ? accountId : other, to_account_id: out ? other : accountId,
        transferred_at: `${r.date}T12:00:00Z`,
      });
      if (error) throw new Error(error.message);
    } else if (r.kind === "income" || r.amount > 0) {
      const { error } = await supabase.from("finance_incomes").insert({
        user_id: userId, amount: Math.abs(r.amount), label: r.text || "Inkomst", kind: r.category === "Lön" ? "lon" : "annat",
        category: r.category, account_id: accountId, expected_on: r.date, received_on: r.date, is_received: true, note: "Från kontoutdrag",
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("spend_entries").insert({
        user_id: userId, amount: Math.abs(r.amount), note, category: r.category, account_id: accountId, spent_at: `${r.date}T12:00:00Z`,
      });
      if (error) throw new Error(error.message);
    }
  }

  async function onFile(file: File) {
    setBusy(true); setSummary(null); setReview([]);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Du är inte inloggad.");
      const parsed = await readFile(file);
      if (!parsed.rows.length && !parsed.rawText) throw new Error("Hittade inga transaktioner i filen. Prova CSV- eller Excel-exporten från banken.");
      const bankName = parsed.bank === "okänd" ? "" : parsed.bank;
      const accountId = bankName ? accountFor(bankName) : null;

      const res = await classify({ data: {
        bank: parsed.bank, accounts: accounts.map((a) => a.name),
        rows: parsed.rows.slice(0, 400).map((r, i) => ({ i, ...r })), rawText: parsed.rawText,
      } });
      const items = res.items;
      if (!items.length) throw new Error("AI:n hittade inga transaktioner.");

      const dates = items.map((r) => r.date).sort();
      const from = new Date(Date.parse(dates[0] ?? "") - 4 * 86400000).toISOString();
      const to = new Date(Date.parse(dates[dates.length - 1] ?? "") + 4 * 86400000).toISOString();
      const [sp, inc, tr] = await Promise.all([
        supabase.from("spend_entries").select("amount,note,spent_at").gte("spent_at", from).lte("spent_at", to),
        supabase.from("finance_incomes").select("amount,label,expected_on").gte("expected_on", from.slice(0, 10)).lte("expected_on", to.slice(0, 10)),
        supabase.from("account_transfers").select("amount,note,transferred_at").gte("transferred_at", from).lte("transferred_at", to),
      ]);
      const existing: ExistingRow[] = [
        ...(sp.data ?? []).map((r) => ({ date: r.spent_at.slice(0, 10), amount: -Number(r.amount), text: r.note ?? "", kind: "spend" as const })),
        ...(inc.data ?? []).map((r) => ({ date: r.expected_on, amount: Number(r.amount), text: r.label ?? "", kind: "income" as const })),
      ];
      const transfers = (tr.data ?? []).map((r) => ({ date: r.transferred_at.slice(0, 10), amount: Number(r.amount) }));

      let saved = 0, dups = 0;
      const pending: Review[] = [];
      for (const r of items) {
        if (r.kind === "transfer") {
          if (findTransferPair(r, transfers)) { dups++; continue; }
          if (r.confidence >= 0.85) { await saveRow(r, accountId, u.user.id); saved++; }
          else pending.push({ ...r, reason: "Osäker överföring" });
          continue;
        }
        const dup = findDuplicate(r, existing);
        if (dup === "exakt") { dups++; continue; }
        if (shouldAutoSave(r.confidence, dup)) {
          await saveRow(r, accountId, u.user.id);
          saved++;
        } else pending.push({ ...r, reason: dup ? "Möjlig dubblett" : "Osäker kategori" });
      }
      setCtx({ accountId, userId: u.user.id });
      setReview(pending);
      setSummary(`${saved} nya sparade, ${dups} dubbletter hoppades över, ${pending.length} att granska. Svarade via ${LABEL[res.provider] ?? res.provider}.`);
      ["spend_entries", "finance_incomes", "account_transfers", "finance_accounts"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte läsa kontoutdraget.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function accept(r: Review) {
    if (!ctx) return;
    try {
      await saveRow(r, ctx.accountId, ctx.userId);
      setReview((list) => list.filter((x) => x !== r));
      ["spend_entries", "finance_incomes", "account_transfers"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Kunde inte spara."); }
  }

  return (
    <SectionCard title="Läs in kontoutdrag" icon={FileSpreadsheet}>
      <p className="text-sm text-muted-foreground">
        SEB eller Revolut – CSV, Excel eller PDF. Nya händelser sparas automatiskt, dubbletter hoppas över och överföringar mellan dina konton hamnar under Överföring. Kontosaldon ändras inte.
      </p>
      <input ref={input} type="file" accept=".csv,.txt,.xlsx,.xls,.pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <Button className="mt-3" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
        {busy ? "Läser in…" : "Välj kontoutdrag"}
      </Button>
      {summary ? <p className="mt-3 text-sm font-medium">{summary}</p> : null}
      {review.length ? (
        <ul className="mt-3 divide-y rounded-lg border">
          {review.map((r) => (
            <li key={`${r.i}-${r.date}-${r.amount}`} className="flex items-center gap-2 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{r.date} · {r.text || "—"}</p>
                <p className="text-xs text-muted-foreground">{kr(r.amount)} · {r.kind === "transfer" ? "Överföring" : r.category} · {r.reason}</p>
              </div>
              <Button size="sm" onClick={() => accept(r)}>Spara</Button>
              <Button size="sm" variant="ghost" onClick={() => setReview((l) => l.filter((x) => x !== r))}>Hoppa över</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
