import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Plus, RefreshCw, Trash2, Tv, Wallet } from "lucide-react";
import { useState } from "react";
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
  getIptvPanelInfo,
  refreshIptvLine,
  renewIptvLine,
} from "@/lib/iptv.functions";

type IptvRow = Tables<"iptv_lines"> & {
  mac?: string | null;
  protocol_code?: string | null;
  package_name?: string | null;
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

function useIptvLines() {
  return useQuery({
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
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/** Hanterar IPTV-abonnemang: skapa nya aktiveringar, se kunder, förnya och synka status. */
export function IptvPanel() {
  const qc = useQueryClient();
  const linesQ = useIptvLines();
  const create = useServerFn(createIptvLine);
  const renew = useServerFn(renewIptvLine);
  const refresh = useServerFn(refreshIptvLine);
  const panelInfo = useServerFn(getIptvPanelInfo);

  const infoQ = useQuery({
    queryKey: ["iptv_panel_info"],
    queryFn: () => panelInfo({ data: undefined }),
    staleTime: 5 * 60 * 1000,
  });

  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [deviceType, setDeviceType] = useState("m3u");
  const [packageId, setPackageId] = useState("");
  const [mac, setMac] = useState("");
  const [months, setMonths] = useState("12");
  const [note, setNote] = useState("");

  const bouquets = infoQ.data?.bouquets ?? [];

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
      qc.invalidateQueries({ queryKey: ["iptv_lines"] });
      qc.invalidateQueries({ queryKey: ["iptv_panel_info"] });
      toast.success("Aktivering skapad");
      setOpen(false);
      setCustomerName("");
      setMac("");
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renewMutation = useMutation({
    mutationFn: (vars: { id: string; months: number }) => renew({ data: vars }),
    onSuccess: async (_r, vars) => {
      await refresh({ data: { id: vars.id } }).catch(() => null);
      qc.invalidateQueries({ queryKey: ["iptv_lines"] });
      qc.invalidateQueries({ queryKey: ["iptv_panel_info"] });
      toast.success("Abonnemanget förnyat");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => refresh({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iptv_lines"] });
      toast.success("Status uppdaterad");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("iptv_lines").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iptv_lines"] });
      toast.success("Raden borttagen");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lines = linesQ.data ?? [];
  const info = infoQ.data;

  return (
    <section className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Tv className="size-4 text-primary" /> IPTV-abonnemang
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={infoQ.isFetching}
            onClick={() => {
              infoQ.refetch().then((r) => {
                if (r.data?.ok) toast.success(`Panelen svarar – ${r.data.credits ?? "?"} krediter`);
                else toast.error(r.data?.message ?? "Panelen svarar inte");
              });
            }}
          >
            {infoQ.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Testa panel
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Ny aktivering
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

      <div className="mt-4 space-y-2">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inga aktiveringar ännu. Skapa din första med knappen ovan.
          </p>
        ) : (
          lines.map((line) => {
            const left = daysLeft(line.expires_at);
            return (
              <div key={line.id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {line.customer_name}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs uppercase text-muted-foreground">
                    {line.device_type}
                  </span>
                  {line.expires_at ? (
                    <span
                      className={`text-xs tabular-nums ${
                        left != null && left < 7 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      Går ut {fmt(line.expires_at, "d MMM yyyy")}
                      {left != null ? ` (${left} d)` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Utgång okänd</span>
                  )}
                </div>

                {line.package_name ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{line.package_name}</p>
                ) : null}

                {line.m3u_url ? (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(line.m3u_url ?? "");
                      toast.success("Länken kopierad");
                    }}
                    className="mt-1 flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3 shrink-0" />
                    <span className="truncate">{line.m3u_url}</span>
                  </button>
                ) : null}

                {line.protocol_code ? (
                  <p className="mt-1 text-xs text-muted-foreground">Kod: {line.protocol_code}</p>
                ) : null}
                {line.mac ? (
                  <p className="mt-1 text-xs text-muted-foreground">MAC: {line.mac}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    onValueChange={(v) => renewMutation.mutate({ id: line.id, months: Number(v) })}
                  >
                    <SelectTrigger className="h-8 w-[150px] text-xs">
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
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={refreshMutation.isPending}
                    onClick={() => refreshMutation.mutate(line.id)}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm("Ta bort raden ur appen? Panelen påverkas inte.")) {
                        removeMutation.mutate(line.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ny aktivering</DialogTitle>
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
            {deviceType === "mag" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="iptv-mac">MAC-adress</Label>
                <Input
                  id="iptv-mac"
                  value={mac}
                  maxLength={40}
                  placeholder="00:1A:79:XX:XX:XX"
                  onChange={(e) => setMac(e.target.value)}
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label>Paket</Label>
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder={bouquets.length ? "Välj paket" : "Hämtar paket…"} />
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
              disabled={
                !customerName.trim() ||
                !packageId ||
                (deviceType === "mag" && !mac.trim()) ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Skapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
