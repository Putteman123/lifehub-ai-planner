import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, Tv, Trash2, Copy } from "lucide-react";
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
import { checkIptvPanel, createIptvLine, renewIptvLine } from "@/lib/iptv.functions";

type IptvRow = Tables<"iptv_lines">;

const DEVICE_TYPES = [
  { value: "m3u", label: "M3U" },
  { value: "mag", label: "MAG" },
  { value: "enigma", label: "Enigma2" },
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

/** Hanterar IPTV-abonnemang: skapa nya aktiveringar, se kunder och förnya. */
export function IptvPanel() {
  const qc = useQueryClient();
  const linesQ = useIptvLines();
  const create = useServerFn(createIptvLine);
  const renew = useServerFn(renewIptvLine);
  const check = useServerFn(checkIptvPanel);

  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [deviceType, setDeviceType] = useState("m3u");
  const [packageId, setPackageId] = useState("all");
  const [months, setMonths] = useState("12");
  const [note, setNote] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          customerName: customerName.trim(),
          deviceType,
          packageId: packageId.trim() || "all",
          months: Number(months),
          note: note.trim() || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iptv_lines"] });
      toast.success("Aktivering skapad");
      setOpen(false);
      setCustomerName("");
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renewMutation = useMutation({
    mutationFn: (vars: { id: string; months: number }) => renew({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iptv_lines"] });
      toast.success("Abonnemanget förnyat");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const checkMutation = useMutation({
    mutationFn: () => check({ data: undefined }),
    onSuccess: (res) =>
      res.ok ? toast.success("Panelen svarar – nyckeln fungerar") : toast.error(res.message),
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
            disabled={checkMutation.isPending}
            onClick={() => checkMutation.mutate()}
          >
            {checkMutation.isPending ? (
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

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    onValueChange={(v) =>
                      renewMutation.mutate({ id: line.id, months: Number(v) })
                    }
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
            <div className="grid gap-1.5">
              <Label htmlFor="iptv-pack">Paket-ID</Label>
              <Input
                id="iptv-pack"
                value={packageId}
                maxLength={40}
                placeholder='"all" eller paketets ID, t.ex. 132'
                onChange={(e) => setPackageId(e.target.value)}
              />
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
              disabled={!customerName.trim() || createMutation.isPending}
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
