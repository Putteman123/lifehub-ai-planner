import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDeleteRow, useMailRules, useUpsertRow } from "@/lib/db";
import { MAIL_RULE_KINDS, buildGmailQuery, type MailRuleKind } from "@/lib/mail-rules";

/** Hantera vilka mejl som får synas på översikten och i AI-sammanfattningar. */
export function MailRulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const rulesQ = useMailRules();
  const save = useUpsertRow("mail_rules", "Regel sparad");
  const remove = useDeleteRow("mail_rules", "Regel borttagen");
  const [kind, setKind] = useState<MailRuleKind>("label");
  const [mode, setMode] = useState<"include" | "exclude">("include");
  const [value, setValue] = useState("");

  const rules = rulesQ.data ?? [];
  const preview = buildGmailQuery("is:unread in:inbox", rules);

  const add = () => {
    if (!value.trim()) return;
    save.mutate({ kind, mode, value: value.trim(), is_active: true });
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mejlregler</DialogTitle>
          <DialogDescription>
            Styr vilka mejl som visas på översikten och som Andrea använder i sammanfattningar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {MAIL_RULE_KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  kind === k.value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {k.label}
              </button>
            ))}
            <button
              onClick={() => setMode(mode === "include" ? "exclude" : "include")}
              className={`ml-auto rounded-full border px-3 py-1 text-xs ${
                mode === "include"
                  ? "border-transparent bg-cat-ledig/15 text-cat-ledig"
                  : "border-transparent bg-cat-viktigt/15 text-cat-viktigt"
              }`}
            >
              {mode === "include" ? "Visa" : "Dölj"}
            </button>
          </div>

          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={MAIL_RULE_KINDS.find((k) => k.value === kind)?.hint}
            />
            <Button onClick={add} disabled={!value.trim()} size="icon" aria-label="Lägg till regel">
              <Plus className="size-4" />
            </Button>
          </div>

          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {rules.length === 0 ? (
              <li className="text-sm text-muted-foreground">Inga regler än – alla mejl visas.</li>
            ) : (
              rules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={(checked) =>
                      save.mutate({ ...r, is_active: checked })
                    }
                    aria-label="Aktivera regel"
                  />
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                      r.mode === "include"
                        ? "bg-cat-ledig/15 text-cat-ledig"
                        : "bg-cat-viktigt/15 text-cat-viktigt"
                    }`}
                  >
                    {r.mode === "include" ? "Visa" : "Dölj"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {MAIL_RULE_KINDS.find((k) => k.value === r.kind)?.label}: {r.value}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Ta bort regel"
                    onClick={() => remove.mutate(r.id)}
                  >
                    <Trash2 className="size-4 text-cat-viktigt" />
                  </Button>
                </li>
              ))
            )}
          </ul>

          <p className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {preview}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
