import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  CustomerForm,
  emptyCustomer,
  toCustomerPayload,
  type CustomerFormValues,
} from "@/components/care/CustomerForm";
import {
  PermissionMatrixEditor,
  matrixToRows,
  rowsToMatrix,
} from "@/components/care/PermissionMatrixEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CARE_MODULES, ROLE_LABELS, emptyMatrix, type CareRole, type PermissionMatrix } from "@/lib/care";
import {
  addCareClient,
  getCareContext,
  getOrgPermissions,
  inviteMember,
  listOrganizations,
  listOrgPeople,
  removeInvite,
  setOrgModules,
  setOrgPermissions,
  updateCustomer,
} from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/v/kund/$orgId")({
  head: () => ({
    meta: [
      { title: "Kund – livo.health" },
      { name: "description", content: "Uppgifter, behörigheter, personal och brukare för kunden." },
    ],
  }),
  component: CustomerDetail,
});

const INVITE_ROLES: CareRole[] = ["org_admin", "caregiver", "client", "relative"];

function CustomerDetail() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();

  const fetchContext = useServerFn(getCareContext);
  const fetchOrgs = useServerFn(listOrganizations);
  const fetchPeople = useServerFn(listOrgPeople);
  const fetchPerms = useServerFn(getOrgPermissions);
  const savePerms = useServerFn(setOrgPermissions);
  const saveCustomer = useServerFn(updateCustomer);
  const saveModules = useServerFn(setOrgModules);
  const invite = useServerFn(inviteMember);
  const dropInvite = useServerFn(removeInvite);
  const addClient = useServerFn(addCareClient);

  const ctx = useQuery({ queryKey: ["care-context"], queryFn: () => fetchContext({}) });
  const orgs = useQuery({ queryKey: ["care-orgs"], queryFn: () => fetchOrgs({}) });
  const people = useQuery({
    queryKey: ["care-people", orgId],
    queryFn: () => fetchPeople({ data: { orgId } }),
  });
  const perms = useQuery({
    queryKey: ["care-perms", orgId],
    queryFn: () => fetchPerms({ data: { orgId } }),
  });

  const isOwner = ctx.data?.isOwner === true;
  const org = orgs.data?.find((o) => o.id === orgId);

  const [values, setValues] = useState<CustomerFormValues>(emptyCustomer);
  const [matrix, setMatrix] = useState<PermissionMatrix>(() => emptyMatrix());
  const [newInvite, setNewInvite] = useState({ display_name: "", email: "", role: "caregiver" });
  const [newClient, setNewClient] = useState({ name: "", address: "", phone: "" });

  useEffect(() => {
    if (!org) return;
    setValues({
      name: org.name ?? "",
      org_number: org.org_number ?? "",
      segment: org.segment ?? "kommun",
      address: org.address ?? "",
      website: org.website ?? "",
      contact_name: org.contact_name ?? "",
      contact_role: org.contact_role ?? "",
      contact_email: org.contact_email ?? "",
      contact_phone: org.contact_phone ?? "",
      billing_address: org.billing_address ?? "",
      billing_email: org.billing_email ?? "",
      billing_reference: org.billing_reference ?? "",
      contract_start: org.contract_start ?? "",
      contract_type: org.contract_type ?? "pilot",
      status: org.status ?? "prospekt",
      seats: org.seats != null ? String(org.seats) : "",
      internal_notes: org.internal_notes ?? "",
    });
  }, [org]);

  useEffect(() => {
    if (perms.data) setMatrix(rowsToMatrix(perms.data, emptyMatrix()));
  }, [perms.data]);

  const refreshPeople = () => qc.invalidateQueries({ queryKey: ["care-people", orgId] });
  const refreshOrgs = () => qc.invalidateQueries({ queryKey: ["care-orgs"] });

  const customerMutation = useMutation({
    mutationFn: () => saveCustomer({ data: { orgId, customer: toCustomerPayload(values) } }),
    onSuccess: () => {
      toast.success("Uppgifterna är sparade.");
      void refreshOrgs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const permsMutation = useMutation({
    mutationFn: () => savePerms({ data: { orgId, permissions: matrixToRows(matrix) } }),
    onSuccess: () => {
      toast.success("Behörigheterna är sparade.");
      void qc.invalidateQueries({ queryKey: ["care-perms", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moduleMutation = useMutation({
    mutationFn: (modules: string[]) => saveModules({ data: { orgId, modules } }),
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
          orgId,
          email: newInvite.email,
          display_name: newInvite.display_name,
          role: newInvite.role as CareRole,
        },
      }),
    onSuccess: (result: { emailSent?: boolean }) => {
      setNewInvite({ display_name: "", email: "", role: "caregiver" });
      toast.success(
        result?.emailSent
          ? "Inbjudan skickad med mejl."
          : "Inbjudan skapad, men mejlet gick inte fram. Dela länken manuellt.",
      );
      void refreshPeople();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientMutation = useMutation({
    mutationFn: () =>
      addClient({
        data: {
          orgId,
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

  return (
    <div className="space-y-6">
      <div>
        <Link to="/v/organisationer" className="text-sm text-muted-foreground hover:text-foreground">
          ← Alla kunder
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {org?.name ?? "Kund"}
        </h1>
      </div>

      <Tabs defaultValue="uppgifter">
        <TabsList>
          <TabsTrigger value="uppgifter">Uppgifter</TabsTrigger>
          <TabsTrigger value="behorigheter">Behörigheter</TabsTrigger>
          <TabsTrigger value="personer">Personer</TabsTrigger>
          <TabsTrigger value="brukare">Brukare</TabsTrigger>
        </TabsList>

        <TabsContent value="uppgifter" className="mt-6">
          <div className="rounded-3xl border border-border/70 bg-card p-6">
            <CustomerForm values={values} onChange={setValues} />
            <Button
              className="mt-6"
              disabled={customerMutation.isPending || values.name.trim().length < 2}
              onClick={() => customerMutation.mutate()}
            >
              Spara uppgifter
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="behorigheter" className="mt-6 space-y-6">
          <div className="rounded-3xl border border-border/70 bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Moduler</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOwner ? "Bocka i vad kunden får tillgång till." : "Tilldelade av systemägaren."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CARE_MODULES.map((m) => {
                const on = org?.modules.includes(m.key) ?? false;
                return (
                  <label
                    key={m.key}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 p-3"
                  >
                    <Checkbox
                      checked={on}
                      disabled={!isOwner || moduleMutation.isPending || !org}
                      onCheckedChange={(v) => {
                        const base = org?.modules ?? [];
                        moduleMutation.mutate(
                          v ? [...base, m.key] : base.filter((x) => x !== m.key),
                        );
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

          <div className="rounded-3xl border border-border/70 bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Rättigheter per roll</h2>
            <div className="mt-4">
              <PermissionMatrixEditor matrix={matrix} onChange={setMatrix} />
            </div>
            <Button
              className="mt-6"
              disabled={permsMutation.isPending}
              onClick={() => permsMutation.mutate()}
            >
              Spara behörigheter
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="personer" className="mt-6">
          <div className="rounded-3xl border border-border/70 bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Personer</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(people.data?.members ?? []).map((m) => (
                <li key={m.id}>
                  {m.display_name ?? m.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role as CareRole]}
                  </span>
                </li>
              ))}
              {(people.data?.members ?? []).length === 0 ? (
                <li className="text-muted-foreground">Inga medlemmar ännu.</li>
              ) : null}
            </ul>

            <h3 className="mt-6 text-sm font-semibold">Bjud in</h3>
            <div className="mt-3 grid gap-3 sm:max-w-md">
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
                  {INVITE_ROLES.map((r) => (
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
        </TabsContent>

        <TabsContent value="brukare" className="mt-6">
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
            <div className="mt-5 grid gap-3 sm:max-w-md">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
