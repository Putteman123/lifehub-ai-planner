import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARE_MODULES, moduleLabel, ROLE_LABELS, type CareRole } from "@/lib/care";
import {
  addCareClient,
  createOrganization,
  getCareContext,
  inviteMember,
  listLeads,
  listOrganizations,
  listOrgPeople,
  removeInvite,
  setOrgModules,
} from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/v/organisationer")({
  head: () => ({
    meta: [
      { title: "Organisationer – LifeHub Vård" },
      { name: "description", content: "Skapa verksamheter, styr moduler och bjud in personal." },
    ],
  }),
  component: OrgAdmin,
});

const ROLES: CareRole[] = ["org_admin", "caregiver", "client", "relative"];

function OrgAdmin() {
  const qc = useQueryClient();
  const fetchContext = useServerFn(getCareContext);
  const fetchOrgs = useServerFn(listOrganizations);
  const fetchPeople = useServerFn(listOrgPeople);
  const fetchLeads = useServerFn(listLeads);
  const createOrg = useServerFn(createOrganization);
  const saveModules = useServerFn(setOrgModules);
  const invite = useServerFn(inviteMember);
  const dropInvite = useServerFn(removeInvite);
  const addClient = useServerFn(addCareClient);

  const [selected, setSelected] = useState<string | null>(null);
  const [newOrg, setNewOrg] = useState({ name: "", org_number: "", contact_email: "" });
  const [newInvite, setNewInvite] = useState({ display_name: "", email: "", role: "caregiver" });
  const [newClient, setNewClient] = useState({ name: "", address: "", phone: "" });

  const ctx = useQuery({ queryKey: ["care-context"], queryFn: () => fetchContext({}) });
  const orgs = useQuery({ queryKey: ["care-orgs"], queryFn: () => fetchOrgs({}) });
  const isOwner = ctx.data?.isOwner === true;
  const activeOrg = selected ?? orgs.data?.[0]?.id ?? null;

  const people = useQuery({
    queryKey: ["care-people", activeOrg],
    queryFn: () => fetchPeople({ data: { orgId: activeOrg! } }),
    enabled: !!activeOrg,
  });
  const leads = useQuery({
    queryKey: ["care-leads"],
    queryFn: () => fetchLeads({}),
    enabled: isOwner,
  });

  const refreshOrgs = () => qc.invalidateQueries({ queryKey: ["care-orgs"] });
  const refreshPeople = () => qc.invalidateQueries({ queryKey: ["care-people", activeOrg] });

  const createMutation = useMutation({
    mutationFn: () =>
      createOrg({
        data: {
          name: newOrg.name,
          org_number: newOrg.org_number || undefined,
          contact_email: newOrg.contact_email || undefined,
          modules: ["schema", "medicin", "karta", "uppgifter"],
        },
      }),
    onSuccess: () => {
      setNewOrg({ name: "", org_number: "", contact_email: "" });
      toast.success("Organisationen är skapad.");
      void refreshOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moduleMutation = useMutation({
    mutationFn: (vars: { orgId: string; modules: string[] }) => saveModules({ data: vars }),
    onSuccess: () => {
      toast.success("Moduler uppdaterade.");
      void refreshOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      invite({
        data: {
          orgId: activeOrg!,
          email: newInvite.email,
          display_name: newInvite.display_name,
          role: newInvite.role as CareRole,
        },
      }),
    onSuccess: () => {
      setNewInvite({ display_name: "", email: "", role: "caregiver" });
      toast.success("Inbjudan skapad.");
      void refreshPeople();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientMutation = useMutation({
    mutationFn: () =>
      addClient({
        data: {
          orgId: activeOrg!,
          name: newClient.name,
          address: newClient.address || undefined,
          phone: newClient.phone || undefined,
        },
      }),
    onSuccess: () => {
      setNewClient({ name: "", address: "", phone: "" });
      toast.success("Brukaren är tillagd.");
      void refreshPeople();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = orgs.data?.find((o) => o.id === activeOrg);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Organisationer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verksamheter, moduler, personal och brukare.
        </p>
      </div>

      {isOwner ? (
        <section className="rounded-3xl border border-border/70 bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Ny organisation</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Namn</Label>
              <Input
                id="org-name"
                value={newOrg.name}
                onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-number">Org.nummer</Label>
              <Input
                id="org-number"
                value={newOrg.org_number}
                onChange={(e) => setNewOrg({ ...newOrg, org_number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-email">Kontakt-e-post</Label>
              <Input
                id="org-email"
                type="email"
                value={newOrg.contact_email}
                onChange={(e) => setNewOrg({ ...newOrg, contact_email: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={newOrg.name.trim().length < 2 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Skapa organisation
          </Button>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(orgs.data ?? []).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o.id)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                o.id === activeOrg
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.name}
            </button>
          ))}
          {orgs.isLoading ? <span className="text-sm text-muted-foreground">Hämtar…</span> : null}
          {!orgs.isLoading && (orgs.data ?? []).length === 0 ? (
            <span className="text-sm text-muted-foreground">Inga organisationer ännu.</span>
          ) : null}
        </div>

        {current ? (
          <div className="rounded-3xl border border-border/70 bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Moduler för {current.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOwner
                ? "Bocka i vad verksamheten får tillgång till."
                : "Tilldelade av systemägaren."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CARE_MODULES.map((m) => {
                const on = current.modules.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 p-3"
                  >
                    <Checkbox
                      checked={on}
                      disabled={!isOwner || moduleMutation.isPending}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...current.modules, m.key]
                          : current.modules.filter((x) => x !== m.key);
                        moduleMutation.mutate({ orgId: current.id, modules: next });
                      }}
                    />
                    <span>
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeOrg ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Personer</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {(people.data?.members ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <span>
                      {m.display_name ?? m.email}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ROLE_LABELS[m.role as CareRole]}
                      </span>
                    </span>
                  </li>
                ))}
                {(people.data?.members ?? []).length === 0 ? (
                  <li className="text-muted-foreground">Inga medlemmar ännu.</li>
                ) : null}
              </ul>

              <h3 className="mt-6 text-sm font-semibold">Bjud in</h3>
              <div className="mt-3 grid gap-3">
                <Input
                  placeholder="Namn"
                  value={newInvite.display_name}
                  onChange={(e) => setNewInvite({ ...newInvite, display_name: e.target.value })}
                />
                <Input
                  type="email"
                  placeholder="E-post"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                />
                <Select
                  value={newInvite.role}
                  onValueChange={(v) => setNewInvite({ ...newInvite, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={
                    inviteMutation.isPending ||
                    newInvite.display_name.trim().length < 2 ||
                    !newInvite.email.includes("@")
                  }
                  onClick={() => inviteMutation.mutate()}
                >
                  Skapa inbjudan
                </Button>
              </div>

              {(people.data?.invites ?? []).length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {people.data?.invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {i.email} · {ROLE_LABELS[i.role as CareRole]} · {i.status}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await dropInvite({ data: { id: i.id } });
                          void refreshPeople();
                        }}
                      >
                        Ta bort
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-3xl border border-border/70 bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Brukare</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {(people.data?.clients ?? []).map((c) => (
                  <li key={c.id}>
                    {c.name}
                    {c.address ? (
                      <span className="ml-2 text-xs text-muted-foreground">{c.address}</span>
                    ) : null}
                  </li>
                ))}
                {(people.data?.clients ?? []).length === 0 ? (
                  <li className="text-muted-foreground">Inga brukare ännu.</li>
                ) : null}
              </ul>
              <div className="mt-5 grid gap-3">
                <Input
                  placeholder="Namn (använd påhittade namn i alfatest)"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
                <Input
                  placeholder="Adress"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                />
                <Input
                  placeholder="Telefon"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                />
                <Button
                  variant="outline"
                  disabled={clientMutation.isPending || newClient.name.trim().length < 2}
                  onClick={() => clientMutation.mutate()}
                >
                  Lägg till brukare
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {isOwner && (leads.data ?? []).length > 0 ? (
        <section className="rounded-3xl border border-border/70 bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Intresseanmälningar</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {leads.data?.map((l) => (
              <li key={l.id} className="rounded-2xl border border-border/70 p-3">
                <p className="font-medium">
                  {l.org_name} · {l.contact_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.email}
                  {l.phone ? ` · ${l.phone}` : ""}
                  {l.segment ? ` · ${l.segment}` : ""}
                </p>
                {l.message ? <p className="mt-2 text-muted-foreground">{l.message}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
