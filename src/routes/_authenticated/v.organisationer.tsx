import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CustomerForm, emptyCustomer, toCustomerPayload, type CustomerFormValues } from "@/components/care/CustomerForm";
import { PermissionMatrixEditor, matrixToRows } from "@/components/care/PermissionMatrixEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CARE_MODULES,
  ORG_STATUS,
  PERMISSION_TEMPLATES,
  emptyMatrix,
  moduleLabel,
  type PermissionMatrix,
} from "@/lib/care";
import { createCustomer, getCareContext, listLeads, listOrganizations } from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/v/organisationer")({
  head: () => ({
    meta: [
      { title: "Kunder – LifeHub Vård" },
      {
        name: "description",
        content: "Lägg upp nya kunder, styr moduler och sätt behörigheter per roll.",
      },
    ],
  }),
  component: CustomerList,
});

const DEFAULT_MODULES = ["schema", "uppgifter", "medicin", "karta", "personuppgifter"];

function CustomerList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchContext = useServerFn(getCareContext);
  const fetchOrgs = useServerFn(listOrganizations);
  const fetchLeads = useServerFn(listLeads);
  const create = useServerFn(createCustomer);

  const ctx = useQuery({ queryKey: ["care-context"], queryFn: () => fetchContext({}) });
  const orgs = useQuery({ queryKey: ["care-orgs"], queryFn: () => fetchOrgs({}) });
  const isOwner = ctx.data?.isOwner === true;
  const leads = useQuery({ queryKey: ["care-leads"], queryFn: () => fetchLeads({}), enabled: isOwner });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<CustomerFormValues>(emptyCustomer);
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES);
  const [matrix, setMatrix] = useState<PermissionMatrix>(
    () => structuredClone(PERMISSION_TEMPLATES[0]?.matrix ?? emptyMatrix()),
  );

  const reset = () => {
    setOpen(false);
    setStep(1);
    setValues(emptyCustomer);
    setModules(DEFAULT_MODULES);
    setMatrix(structuredClone(PERMISSION_TEMPLATES[0]?.matrix ?? emptyMatrix()));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          customer: toCustomerPayload(values),
          modules,
          permissions: matrixToRows(matrix).filter((r) => modules.includes(r.module)),
        },
      }),
    onSuccess: (res: { id: string }) => {
      toast.success("Kunden är upplagd.");
      void qc.invalidateQueries({ queryKey: ["care-orgs"] });
      reset();
      void navigate({ to: "/v/kund/$orgId", params: { orgId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Kunder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vårdföretag och verksamheter, med moduler och behörigheter per roll.
          </p>
        </div>
        {isOwner ? (
          <Button onClick={() => setOpen((v) => !v)}>{open ? "Avbryt" : "Ny kund"}</Button>
        ) : null}
      </div>

      {isOwner && open ? (
        <section className="rounded-3xl border border-border/70 bg-card p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {["Företagsuppgifter", "Kontakt och avtal", "Behörigheter"].map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1 ${
                  step === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {i + 1}. {label}
              </span>
            ))}
          </div>

          <div className="mt-6">
            {step === 1 ? (
              <CustomerForm values={values} onChange={setValues} step="company" />
            ) : null}
            {step === 2 ? (
              <CustomerForm values={values} onChange={setValues} step="contract" />
            ) : null}
            {step === 3 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold">Moduler kunden får tillgång till</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {CARE_MODULES.map((m) => (
                      <label
                        key={m.key}
                        className="flex items-start gap-3 rounded-2xl border border-border/70 p-3"
                      >
                        <Checkbox
                          checked={modules.includes(m.key)}
                          onCheckedChange={(v) =>
                            setModules((prev) =>
                              v ? [...prev, m.key] : prev.filter((x) => x !== m.key),
                            )
                          }
                        />
                        <span>
                          <span className="block text-sm font-medium">{m.label}</span>
                          <span className="block text-xs text-muted-foreground">{m.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Behörigheter per roll</h3>
                  <div className="mt-3">
                    <PermissionMatrixEditor matrix={matrix} onChange={setMatrix} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Tillbaka
              </Button>
            ) : null}
            {step < 3 ? (
              <Button disabled={values.name.trim().length < 2} onClick={() => setStep(step + 1)}>
                Nästa
              </Button>
            ) : (
              <Button
                disabled={createMutation.isPending || values.name.trim().length < 2}
                onClick={() => createMutation.mutate()}
              >
                Spara kunden
              </Button>
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        {(orgs.data ?? []).map((o) => (
          <Link
            key={o.id}
            to="/v/kund/$orgId"
            params={{ orgId: o.id }}
            className="rounded-3xl border border-border/70 bg-card p-6 transition-colors hover:border-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{o.name}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                {ORG_STATUS.find((s) => s.key === o.status)?.label ?? o.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {o.staffCount} personal · {o.clientCount} brukare · {o.relativeCount} anhöriga
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.modules.length === 0 ? (
                <span className="text-xs text-muted-foreground">Inga moduler påslagna</span>
              ) : (
                o.modules.map((m) => (
                  <span key={m} className="rounded-full bg-secondary px-3 py-1 text-xs">
                    {moduleLabel(m)}
                  </span>
                ))
              )}
            </div>
          </Link>
        ))}
        {orgs.isLoading ? <p className="text-sm text-muted-foreground">Hämtar…</p> : null}
        {!orgs.isLoading && (orgs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga kunder upplagda ännu.</p>
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
