import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CareSectionHeader } from "@/components/care/CareUI";
import careMedicineImage from "@/assets/care-medicine.jpg";
import { Check, Pill } from "lucide-react";
import { demoRoleLabel, useDemoRole } from "@/lib/demo-role";
import { listOrgMedications, logMedicationEvent } from "@/lib/care-admin.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/medicin")({
  head: () => ({
    meta: [
      { title: "Medicin – livo.health" },
      {
        name: "description",
        content: "Alla mediciner i verksamheten med tider, delegering och given-logg.",
      },
      { property: "og:title", content: "Medicin – livo.health" },
      {
        property: "og:description",
        content: "Alla mediciner i verksamheten med tider, delegering och given-logg.",
      },
    ],
  }),
  component: MedicationPage,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  });
}

function MedicationPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { role } = useDemoRole();
  const fetchMeds = useServerFn(listOrgMedications);
  const logGiven = useServerFn(logMedicationEvent);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["care-org-medications", slug],
    queryFn: () => fetchMeds({ data: { slug } }),
  });

  const give = useMutation({
    mutationFn: (medicationId: string) =>
      logGiven({ data: { slug, medicationId, role: demoRoleLabel(role) } }),
    onSuccess: () => {
      toast.success("Noterat som given.");
      void qc.invalidateQueries({ queryKey: ["care-org-medications", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastGiven = useMemo(() => {
    const map = new Map<string, { at: string; role: string | null }>();
    for (const e of (q.data?.events ?? []) as {
      medication_id: string;
      given_at: string;
      given_role?: string | null;
    }[]) {
      if (!map.has(e.medication_id)) {
        map.set(e.medication_id, { at: e.given_at, role: e.given_role ?? null });
      }
    }
    return map;
  }, [q.data]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const clients = q.data?.clients ?? [];
  const visibleClients = role === "client" || role === "relative" ? clients.slice(0, 1) : clients;
  const needle = search.trim().toLowerCase();
  const meds = (q.data?.medications ?? []).filter((m) =>
    needle
      ? m.name.toLowerCase().includes(needle) ||
        (clients.find((c) => c.id === m.client_id)?.name.toLowerCase().includes(needle) ?? false)
      : true,
  );

  return (
    <div className="space-y-6">
      <CareSectionHeader
        icon={<Pill className="size-5" />}
        title="Medicin"
        subtitle={`${meds.length} mediciner hos ${clients.length} brukare`}
        image={careMedicineImage}
      />

      <Input
        placeholder="Sök medicin eller brukare"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {visibleClients.map((client) => {
        const rows = meds.filter((m) => m.client_id === client.id);
        if (rows.length === 0) return null;
        return (
          <section key={client.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{client.name}</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/v/f/$slug/brukare/$clientId" params={{ slug, clientId: client.id }}>
                  Öppna brukarkort
                </Link>
              </Button>
            </div>
            <ul className="space-y-2">
              {rows.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {m.name}
                      {m.dose ? ` · ${m.dose}` : ""}
                      {m.requires_delegation ? (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                          Delegering
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.times ?? "Ingen tid angiven"}
                      {m.instructions ? ` · ${m.instructions}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lastGiven.has(m.id)
                        ? `Senast given ${fmt(lastGiven.get(m.id)!.at)}${
                            lastGiven.get(m.id)!.role ? ` · ${lastGiven.get(m.id)!.role}` : ""
                          }`
                        : "Ingen logg ännu"}
                    </p>
                  </div>
                  {role !== "relative" ? (
                    <Button size="sm" disabled={give.isPending} onClick={() => give.mutate(m.id)}>
                      <Check className="size-4" /> Given nu
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {meds.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga mediciner upplagda ännu.</p>
      ) : null}
    </div>
  );
}
