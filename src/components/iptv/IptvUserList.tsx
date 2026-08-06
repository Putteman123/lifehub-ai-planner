import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Copy,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Tv,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fmt } from "@/lib/calendar";
import {
  createIptvLine,
  deleteIptvLine,
  getIptvPanelInfo,
  importIptvLine,
  refreshIptvLine,
  renewIptvLine,
  syncIptvLines,
  updateIptvLine,
} from "@/lib/iptv.functions";

type IptvRow = Tables<"iptv_lines"> & {
  mac?: string | null;
  protocol_code?: string | null;
  package_name?: string | null;
  online?: boolean | null;
  last_synced_at?: string | null;
};

const DEVICE_TYPES = [
  { value: "m3u", label: "M3U" },
  { value: "mag", label: "MAG" },
  { value: "protocol", label: "Protokoll" },
];

const LENGTHS = [
  { value: "1", label: "1 månad" },
  { value: "3", label: "3 månader" },
  { value: "6", label: "6 månader" },
  { value: "12", label: "12 månader" },
  { value: "99", label: "Demo" },
];

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function copy(value: string | null | undefined, label: string) {
  if (!value) return;
  navigator.clipboard.writeText(value);
  toast.success(`${label} kopierad`);
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="card-soft flex items-center gap-3 p-4">
      <span className={`flex size-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: IptvRow }) {
  const left = daysLeft(row.expires_at);
  const expired = left != null && left < 0;
  const cls = expired
    ? "bg-destructive/15 text-destructive"
    : row.status === "pausad"
      ? "bg-muted text-muted-foreground"
      : "bg-cat-handla/15 text-cat-handla";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {expired ? "Utgången" : row.status === "pausad" ? "Pausad" : "Aktiv"}
    </span>
  );
}

/** Full användarlista för IPTV-panelen: statistik, sök, anteckningar och åtgärder. */
export function IptvUserList() {
  const qc = useQueryClient();
  const create = useServerFn(createIptvLine);
  const importLine = useServerFn(importIptvLine);
  const renew = useServerFn(renewIptvLine);
  const refresh = useServerFn(refreshIptvLine);
  const removeLine = useServerFn(deleteIptvLine);
  const updateLine = useServerFn(updateIptvLine);
  const syncAll = useServerFn(syncIptvLines);
  const panelInfo = useServerFn(getIptvPanelInfo);

  const linesQ = useQuery({
    queryKey: ["iptv_lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iptv_lines")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as IptvRow[];
    },
  });

  const infoQ = useQuery({
    queryKey: ["iptv_panel_info"],
    queryFn: () => panelInfo({ data: undefined }),
    staleTime: 5 * 60 * 1000,
  });
  const bouquets = infoQ.data?.bouquets ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("alla");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<{ id: string; value: string } | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [deviceType, setDeviceType] = useState("m3u");
  const [packageId, setPackageId] = useState("");
  const [mac, setMac] = useState("");
  const [months, setMonths] = useState("12");
  const [note, setNote] = useState("");

  const [impName, setImpName] = useState("");
  const [impType, setImpType] = useState("m3u");
  const [impUser, setImpUser] = useState("");
  const [impPass, setImpPass] = useState("");
  const [impMac, setImpMac] = useState("");
  const [impNote, setImpNote] = useState("");

  const lines = useMemo(() => linesQ.data ?? [], [linesQ.data]);

  const stats = useMemo(() => {
    const expired = lines.filter((l) => {
      const left = daysLeft(l.expires_at);
      return left != null && left < 0;
    }).length;
    const active = lines.filter((l) => {
      const left = daysLeft(l.expires_at);
      return l.status !== "pausad" && (left == null || left >= 0);
    }).length;
    return { total: lines.length, active, expired };
  }, [lines]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines
      .filter((l) => {
        const left = daysLeft(l.expires_at);
        if (statusFilter === "aktiva" && !(left == null || left >= 0)) return false;
        if (statusFilter === "utgangna" && !(left != null && left < 0)) return false;
        if (!q) return true;
        return [l.customer_name, l.username, l.note, l.package_name, l.mac]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const av = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const bv = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return av - bv;
      });
  }, [lines, search, statusFilter]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["iptv_lines"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          customerName: customerName.trim(),
          deviceType: deviceType as "m3u" | "mag" | "protocol",
          packageId: packageId.trim(),
          packageName: bouquets.find((b) => b.id === packageId)?.name,
          mac: mac.trim() || undefined,
          months: Number(months),
          note: note.trim() || undefined,
        },
      }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["iptv_panel_info"] });
      toast.success("Användaren skapad");
      setCreateOpen(false);
      setCustomerName("");
      setMac("");
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      importLine({
        data: {
          customerName: impName.trim(),
          deviceType: impType as "m3u" | "mag" | "protocol",
          username: impUser.trim() || undefined,
          password: impPass.trim() || undefined,
          mac: impMac.trim() || undefined,
          note: impNote.trim() || undefined,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Användaren importerad");
      setImportOpen(false);
      setImpName("");
      setImpUser("");
      setImpPass("");
      setImpMac("");
      setImpNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncAll({ data: undefined }),
    onSuccess: (res) => {
      invalidate();
      toast.success(
        `Synkade ${res.updated} linjer${res.failed.length ? ` · ${res.failed.length} misslyckades` : ""}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renewMutation = useMutation({
    mutationFn: (vars: { id: string; months: number }) => renew({ data: vars }),
    onSuccess: async (_r, vars) => {
      await refresh({ data: { id: vars.id } }).catch(() => null);
      invalidate();
      toast.success("Abonnemanget förnyat");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => refresh({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Status uppdaterad");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const noteMutation = useMutation({
    mutationFn: (vars: { id: string; note: string }) =>
      updateLine({ data: { id: vars.id, note: vars.note || null } }),
    onSuccess: () => {
      invalidate();
      setNoteDraft(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeLine({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Raden borttagen");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const info = infoQ.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Users}
          value={stats.total}
          label="Användare totalt"
          tone="bg-cat-viktigt/15 text-cat-viktigt"
        />
        <StatCard
          icon={Wifi}
          value={stats.active}
          label="Aktiva linjer"
          tone="bg-cat-handla/15 text-cat-handla"
        />
        <StatCard
          icon={AlertTriangle}
          value={stats.expired}
          label="Utgångna linjer"
          tone="bg-destructive/15 text-destructive"
        />
      </div>

      <section className="card-soft p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Tv className="size-4 text-primary" /> Användarlista
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Synka
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="size-4" /> Importera
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Ny M3U-användare
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {infoQ.isLoading ? (
            "Kontrollerar panelen…"
          ) : info?.ok ? (
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-3.5" />
              {info.username} · {info.credits} krediter · {bouquets.length} paket
            </span>
          ) : (
            <span className="text-destructive">
              Panelen: {info?.message ?? "kunde inte kontaktas"}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök namn, användarnamn eller anteckning…"
            className="h-9 flex-1 min-w-[12rem]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alla">Alla</SelectItem>
              <SelectItem value="aktiva">Aktiva</SelectItem>
              <SelectItem value="utgangna">Utgångna</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Inga användare matchar. Skapa en ny eller importera en befintlig linje från panelen.
          </p>
        ) : (
          <>
            {/* Tabell för surfplatta och dator */}
            <div className="mt-3 hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Kund</th>
                    <th className="py-2 pr-3 font-medium">Användarnamn</th>
                    <th className="py-2 pr-3 font-medium">Lösenord</th>
                    <th className="py-2 pr-3 font-medium">Paket</th>
                    <th className="py-2 pr-3 font-medium">Utgår</th>
                    <th className="py-2 pr-3 font-medium">Anteckning</th>
                    <th className="py-2 font-medium">Åtgärd</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 align-middle">
                      <td className="py-2 pr-3">
                        <StatusBadge row={row} />
                      </td>
                      <td className="max-w-[10rem] truncate py-2 pr-3 font-medium">
                        {row.customer_name}
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => copy(row.username, "Användarnamn")}
                          className="max-w-[9rem] truncate font-mono text-xs hover:text-primary"
                        >
                          {row.username ?? (row.mac ? `MAC ${row.mac}` : "–")}
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => copy(row.password, "Lösenord")}
                          className="max-w-[9rem] truncate font-mono text-xs text-muted-foreground hover:text-primary"
                        >
                          {row.password ?? "–"}
                        </button>
                      </td>
                      <td className="max-w-[9rem] truncate py-2 pr-3 text-xs text-muted-foreground">
                        {row.package_name ?? row.package_id ?? "–"}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-xs tabular-nums">
                        {row.expires_at ? fmt(row.expires_at, "d MMM yyyy") : "–"}
                      </td>
                      <td className="py-2 pr-3">
                        <NoteCell
                          row={row}
                          draft={noteDraft}
                          setDraft={setNoteDraft}
                          onSave={(value) => noteMutation.mutate({ id: row.id, note: value })}
                        />
                      </td>
                      <td className="py-2">
                        <RowActions
                          row={row}
                          onRenew={(m) => renewMutation.mutate({ id: row.id, months: m })}
                          onRefresh={() => refreshMutation.mutate(row.id)}
                          onDelete={() => {
                            if (confirm("Ta bort raden ur appen? Panelen påverkas inte.")) {
                              removeMutation.mutate(row.id);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kort för mobil */}
            <div className="mt-3 space-y-2 lg:hidden">
              {visible.map((row) => (
                <div key={row.id} className="rounded-2xl border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge row={row} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {row.customer_name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {row.expires_at ? fmt(row.expires_at, "d MMM") : "–"}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {row.username ? (
                      <button
                        className="font-mono hover:text-foreground"
                        onClick={() => copy(row.username, "Användarnamn")}
                      >
                        {row.username}
                      </button>
                    ) : null}
                    {row.password ? (
                      <button
                        className="font-mono hover:text-foreground"
                        onClick={() => copy(row.password, "Lösenord")}
                      >
                        {row.password}
                      </button>
                    ) : null}
                    {row.mac ? <span>MAC {row.mac}</span> : null}
                    {row.package_name ? <span>{row.package_name}</span> : null}
                  </div>

                  {row.m3u_url ? (
                    <button
                      onClick={() => copy(row.m3u_url, "M3U-länken")}
                      className="mt-1.5 flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3 shrink-0" />
                      <span className="truncate">{row.m3u_url}</span>
                    </button>
                  ) : null}

                  <div className="mt-2">
                    <NoteCell
                      row={row}
                      draft={noteDraft}
                      setDraft={setNoteDraft}
                      onSave={(value) => noteMutation.mutate({ id: row.id, note: value })}
                    />
                  </div>

                  <div className="mt-2">
                    <RowActions
                      row={row}
                      onRenew={(m) => renewMutation.mutate({ id: row.id, months: m })}
                      onRefresh={() => refreshMutation.mutate(row.id)}
                      onDelete={() => {
                        if (confirm("Ta bort raden ur appen? Panelen påverkas inte.")) {
                          removeMutation.mutate(row.id);
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ny M3U-användare</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="iptv-customer">Kund</Label>
              <Input
                id="iptv-customer"
                value={customerName}
                maxLength={80}
                placeholder="T.ex. Anna Svensson"
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Typ</Label>
                <Select value={deviceType} onValueChange={setDeviceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Längd</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTHS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Paket</Label>
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj paket" />
                </SelectTrigger>
                <SelectContent>
                  {bouquets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {deviceType === "mag" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="iptv-mac">MAC-adress</Label>
                <Input
                  id="iptv-mac"
                  value={mac}
                  placeholder="00:1A:79:XX:XX:XX"
                  onChange={(e) => setMac(e.target.value)}
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="iptv-note">Anteckning</Label>
              <Input
                id="iptv-note"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={createMutation.isPending || !customerName.trim() || !packageId}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Skapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importera befintlig linje</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Ange inloggningen för ett konto som redan finns i panelen, så hämtas status,
            utgångsdatum och länk automatiskt.
          </p>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="imp-name">Kund</Label>
              <Input id="imp-name" value={impName} onChange={(e) => setImpName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Typ</Label>
              <Select value={impType} onValueChange={setImpType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {impType === "mag" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="imp-mac">MAC-adress</Label>
                <Input id="imp-mac" value={impMac} onChange={(e) => setImpMac(e.target.value)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="imp-user">Användarnamn</Label>
                  <Input
                    id="imp-user"
                    value={impUser}
                    onChange={(e) => setImpUser(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="imp-pass">Lösenord</Label>
                  <Input
                    id="imp-pass"
                    value={impPass}
                    onChange={(e) => setImpPass(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="imp-note">Anteckning</Label>
              <Input
                id="imp-note"
                value={impNote}
                maxLength={200}
                onChange={(e) => setImpNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={importMutation.isPending || !impName.trim()}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Importera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteCell({
  row,
  draft,
  setDraft,
  onSave,
}: {
  row: IptvRow;
  draft: { id: string; value: string } | null;
  setDraft: (value: { id: string; value: string } | null) => void;
  onSave: (value: string) => void;
}) {
  const editing = draft?.id === row.id;
  if (editing) {
    return (
      <Input
        autoFocus
        value={draft.value}
        maxLength={200}
        className="h-8 text-xs"
        onChange={(e) => setDraft({ id: row.id, value: e.target.value })}
        onBlur={() => onSave(draft.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(draft.value.trim());
          if (e.key === "Escape") setDraft(null);
        }}
      />
    );
  }
  return (
    <button
      onClick={() => setDraft({ id: row.id, value: row.note ?? "" })}
      className="max-w-[12rem] truncate text-left text-xs text-muted-foreground hover:text-foreground"
    >
      {row.note?.trim() ? row.note : "Lägg till anteckning"}
    </button>
  );
}

function RowActions({
  row,
  onRenew,
  onRefresh,
  onDelete,
}: {
  row: IptvRow;
  onRenew: (months: number) => void;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select key={row.id} onValueChange={(v) => onRenew(Number(v))}>
        <SelectTrigger className="h-8 w-[8.5rem] text-xs">
          <SelectValue placeholder="Förnya…" />
        </SelectTrigger>
        <SelectContent>
          {LENGTHS.filter((l) => l.value !== "99").map((l) => (
            <SelectItem key={l.value} value={l.value}>
              Förnya {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={onRefresh} aria-label="Uppdatera status">
        <RefreshCw className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        onClick={onDelete}
        aria-label="Ta bort"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
