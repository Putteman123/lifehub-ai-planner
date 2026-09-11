import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { sendMail } from "@/lib/google.functions";

export type MailDraft = { to: string; subject: string; body: string };

/** Skriv och skicka ett mejl via det kopplade Gmail-kontot. */
export function ComposeMailDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft?: MailDraft | null;
}) {
  const send = useServerFn(sendMail);
  const [form, setForm] = useState<MailDraft>({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ to: draft?.to ?? "", subject: draft?.subject ?? "", body: draft?.body ?? "" });
  }, [open, draft]);

  async function submit() {
    if (!form.to.trim() || !form.subject.trim()) {
      toast.error("Fyll i mottagare och ämne.");
      return;
    }
    setSending(true);
    try {
      await send({
        data: { to: form.to.trim(), subject: form.subject.trim(), body: form.body },
      });
      toast.success(`Mejlet till ${form.to.trim()} är skickat.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mejlet kunde inte skickas.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nytt mejl</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mail-to">Till</Label>
            <Input
              id="mail-to"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.to}
              onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
              placeholder="namn@exempel.se"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mail-subject">Ämne</Label>
            <Input
              id="mail-subject"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Vad handlar det om?"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mail-body">Meddelande</Label>
            <Textarea
              id="mail-body"
              rows={8}
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              placeholder="Skriv ditt meddelande…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Skicka
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
