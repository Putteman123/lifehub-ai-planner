import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { VaultGate } from "@/components/kassaskap/VaultGate";
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
import { Textarea } from "@/components/ui/textarea";
import {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  hasPasskey,
} from "@/lib/vault.functions";
import {
  formatBytes,
  isImage,
  signedUrl,
  useDeleteVaultFile,
  useDeleteVaultItem,
  useSaveVaultItem,
  useUploadVaultFiles,
  useVaultFiles,
  useVaultItems,
  VAULT_KINDS,
  type VaultFile,
  type VaultItem,
  type VaultKind,
} from "@/lib/vault";
import { base64urlToBuffer, bufferToBase64url, passkeysSupported } from "@/lib/webauthn";

export const Route = createFileRoute("/_authenticated/kassaskap")({
  head: () => ({
    meta: [
      { title: "Kassaskåp – LifeHub AI" },
      {
        name: "description",
        content: "Ditt låsta kassaskåp för lösenord, pinkoder, skärmdumpar och filer.",
      },
      { property: "og:title", content: "Kassaskåp – LifeHub AI" },
      {
        property: "og:description",
        content: "Öppnas med Face ID eller sexsiffrig pinkod.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [sessionPin, setSessionPin] = useState<string | null>(null);

  return (
    <AppShell
      title="Kassaskåp"
      subtitle={unlocked ? "Lösenord, koder och filer" : "Låst utrymme"}
      actions={
        unlocked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setUnlocked(false);
              setSessionPin(null);
            }}
          >
            <Lock className="size-4" /> Lås
          </Button>
        ) : undefined
      }
    >
      {unlocked ? (
        <VaultContent sessionPin={sessionPin} />
      ) : (
        <VaultGate
          onUnlock={(pin) => {
            setSessionPin(pin);
            setUnlocked(true);
          }}
        />
      )}
    </AppShell>
  );
}

function VaultContent({ sessionPin }: { sessionPin: string | null }) {
  const itemsQ = useVaultItems();
  const filesQ = useVaultFiles();
  const save = useSaveVaultItem();
  const removeItem = useDeleteVaultItem();
  const upload = useUploadVaultFiles();
  const removeFile = useDeleteVaultFile();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<VaultKind>("losenord");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const items = itemsQ.data ?? [];
  const files = filesQ.data ?? [];
  const grouped = useMemo(
    () =>
      VAULT_KINDS.map((k) => ({ ...k, rows: items.filter((i) => i.kind === k.value) })).filter(
        (g) => g.rows.length > 0,
      ),
    [items],
  );

  function openNew() {
    setEditing(null);
    setTitle("");
    setKind("losenord");
    setUsername("");
    setSecret("");
    setUrl("");
    setNotes("");
    setOpen(true);
  }

  function openEdit(item: VaultItem) {
    setEditing(item);
    setTitle(item.title);
    setKind(item.kind);
    setUsername(item.username ?? "");
    setSecret(item.secret ?? "");
    setUrl(item.url ?? "");
    setNotes(item.notes ?? "");
    setOpen(true);
  }

  function submit() {
    if (!title.trim()) return;
    save.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        title: title.trim(),
        kind,
        username: username.trim() || null,
        secret: secret.trim() || null,
        url: url.trim() || null,
        notes: notes.trim() || null,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  async function copy(value: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Kopierat");
  }

  async function openFile(file: VaultFile) {
    try {
      const link = await signedUrl(file.storage_path);
      window.open(link, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4" /> Lösenord & koder
          </h2>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Ny post
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Kassaskåpet är tomt. Lägg in ditt första lösenord eller din första kod.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {grouped.map((group) => (
              <div key={group.value}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((item) => (
                    <li
                      key={item.id}
                      className="group rounded-xl border border-border/70 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          {item.username ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.username}
                            </p>
                          ) : null}
                          {item.secret ? (
                            <p className="mt-1 break-all font-mono text-xs">
                              {revealed[item.id] ? item.secret : "••••••••••"}
                            </p>
                          ) : null}
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block truncate text-xs text-primary underline"
                            >
                              {item.url}
                            </a>
                          ) : null}
                          {item.notes ? (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {item.secret ? (
                            <>
                              <button
                                type="button"
                                aria-label={revealed[item.id] ? "Dölj" : "Visa"}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setRevealed((r) => ({ ...r, [item.id]: !r[item.id] }))
                                }
                              >
                                {revealed[item.id] ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                aria-label="Kopiera"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => void copy(item.secret)}
                              >
                                <Copy className="size-3.5" />
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            aria-label="Redigera"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Ta bort"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem.mutate(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="size-4" /> Filer & skärmdumpar
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={upload.isPending}
            >
              <Upload className="size-4" /> Ladda upp
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              if (list.length) upload.mutate(list);
              e.target.value = "";
            }}
          />

          {files.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Ladda upp skärmdumpar, PDF:er eller andra filer.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-2 text-sm">
                  {isImage(file.mime_type) ? (
                    <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    onClick={() => void openFile(file)}
                  >
                    {file.file_name}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.size_bytes)}
                  </span>
                  <button
                    type="button"
                    aria-label="Ta bort filen"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile.mutate(file)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <FaceIdCard sessionPin={sessionPin} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera post" : "Ny post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-title">Namn</Label>
              <Input
                id="v-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="T.ex. Bank-ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as VaultKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAULT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-user">Användarnamn (valfritt)</Label>
              <Input id="v-user" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-secret">Lösenord / kod</Label>
              <Input
                id="v-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-url">Länk (valfritt)</Label>
              <Input id="v-url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-notes">Anteckning (valfritt)</Label>
              <Textarea
                id="v-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={submit} disabled={!title.trim() || save.isPending}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaceIdCard({ sessionPin }: { sessionPin: string | null }) {
  const begin = useServerFn(beginPasskeyRegistration);
  const finish = useServerFn(finishPasskeyRegistration);
  const check = useServerFn(hasPasskey);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null);

  if (registered === null) void check({}).then((r) => setRegistered(r.registered));
  if (!passkeysSupported()) return null;

  async function register() {
    const code = sessionPin ?? pin.trim();
    if (code.length !== 6) {
      toast.error("Ange din sexsiffriga pinkod.");
      return;
    }
    setBusy(true);
    try {
      const start = await begin({ data: { pin: code } });
      if (!start.ok) {
        toast.error("Fel pinkod.");
        return;
      }
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(start.challenge),
          rp: { id: start.rpId, name: "LifeHub AI" },
          user: {
            id: new TextEncoder().encode(start.userId),
            name: "kassaskap",
            displayName: "Kassaskåpet",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      const response = credential?.response as AuthenticatorAttestationResponse | undefined;
      const spki = response?.getPublicKey?.();
      if (!credential || !spki) {
        toast.error("Face ID kunde inte registreras på den här enheten.");
        return;
      }

      await finish({
        data: {
          credentialId: bufferToBase64url(credential.rawId),
          publicKey: bufferToBase64url(spki),
          clientDataJSON: bufferToBase64url(response!.clientDataJSON),
          challenge: start.challenge,
          label: "Den här enheten",
        },
      });
      setRegistered(true);
      toast.success("Face ID är aktiverat");
    } catch {
      toast.error("Face ID avbröts.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Fingerprint className="size-4" /> Face ID
      </h2>
      {registered ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Face ID är aktiverat på den här enheten. Du kan även aktivera det på fler enheter.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Aktivera Face ID så slipper du knappa in pinkoden varje gång.
        </p>
      )}
      {sessionPin ? null : (
        <Input
          className="mt-3"
          value={pin}
          inputMode="numeric"
          maxLength={6}
          placeholder="Pinkod"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      )}
      <Button className="mt-3 w-full" variant="outline" onClick={() => void register()} disabled={busy}>
        <Fingerprint className="size-4" />
        {registered ? "Lägg till den här enheten" : "Aktivera Face ID"}
      </Button>
    </section>
  );
}
