import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_CONTRACT_TYPES, ORG_SEGMENTS, ORG_STATUS } from "@/lib/care";

export type CustomerFormValues = {
  name: string;
  org_number: string;
  segment: string;
  address: string;
  website: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  billing_address: string;
  billing_email: string;
  billing_reference: string;
  contract_start: string;
  contract_type: string;
  status: string;
  seats: string;
  internal_notes: string;
};

export const emptyCustomer: CustomerFormValues = {
  name: "",
  org_number: "",
  segment: "kommun",
  address: "",
  website: "",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  billing_address: "",
  billing_email: "",
  billing_reference: "",
  contract_start: "",
  contract_type: "pilot",
  status: "prospekt",
  seats: "",
  internal_notes: "",
};

export function toCustomerPayload(v: CustomerFormValues) {
  const t = (s: string) => (s.trim().length > 0 ? s.trim() : undefined);
  return {
    name: v.name.trim(),
    org_number: t(v.org_number),
    segment: t(v.segment),
    address: t(v.address),
    website: t(v.website),
    contact_name: t(v.contact_name),
    contact_role: t(v.contact_role),
    contact_email: t(v.contact_email) ?? "",
    contact_phone: t(v.contact_phone),
    billing_address: t(v.billing_address),
    billing_email: t(v.billing_email) ?? "",
    billing_reference: t(v.billing_reference),
    contract_start: t(v.contract_start) ?? "",
    contract_type: v.contract_type,
    status: v.status,
    seats: v.seats.trim().length > 0 ? Number(v.seats) : undefined,
    internal_notes: t(v.internal_notes),
  };
}

type Props = {
  values: CustomerFormValues;
  onChange: (next: CustomerFormValues) => void;
  step?: "company" | "contract" | "all";
};

export function CustomerForm({ values, onChange, step = "all" }: Props) {
  const set = (patch: Partial<CustomerFormValues>) => onChange({ ...values, ...patch });
  const showCompany = step === "company" || step === "all";
  const showContract = step === "contract" || step === "all";

  return (
    <div className="space-y-6">
      {showCompany ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Företagsnamn" id="c-name">
            <Input id="c-name" value={values.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Organisationsnummer" id="c-orgnr">
            <Input
              id="c-orgnr"
              value={values.org_number}
              onChange={(e) => set({ org_number: e.target.value })}
            />
          </Field>
          <Field label="Bransch" id="c-segment">
            <Select value={values.segment} onValueChange={(v) => set({ segment: v })}>
              <SelectTrigger id="c-segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_SEGMENTS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Webbplats" id="c-web">
            <Input
              id="c-web"
              value={values.website}
              onChange={(e) => set({ website: e.target.value })}
            />
          </Field>
          <Field label="Besöksadress" id="c-address" wide>
            <Input
              id="c-address"
              value={values.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {showContract ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kontaktperson" id="c-cname">
            <Input
              id="c-cname"
              value={values.contact_name}
              onChange={(e) => set({ contact_name: e.target.value })}
            />
          </Field>
          <Field label="Roll" id="c-crole">
            <Input
              id="c-crole"
              value={values.contact_role}
              onChange={(e) => set({ contact_role: e.target.value })}
            />
          </Field>
          <Field label="E-post" id="c-cmail">
            <Input
              id="c-cmail"
              type="email"
              value={values.contact_email}
              onChange={(e) => set({ contact_email: e.target.value })}
            />
          </Field>
          <Field label="Telefon" id="c-cphone">
            <Input
              id="c-cphone"
              value={values.contact_phone}
              onChange={(e) => set({ contact_phone: e.target.value })}
            />
          </Field>
          <Field label="Fakturaadress" id="c-baddr" wide>
            <Input
              id="c-baddr"
              value={values.billing_address}
              onChange={(e) => set({ billing_address: e.target.value })}
            />
          </Field>
          <Field label="Fakturamejl" id="c-bmail">
            <Input
              id="c-bmail"
              type="email"
              value={values.billing_email}
              onChange={(e) => set({ billing_email: e.target.value })}
            />
          </Field>
          <Field label="Referens eller märkning" id="c-bref">
            <Input
              id="c-bref"
              value={values.billing_reference}
              onChange={(e) => set({ billing_reference: e.target.value })}
            />
          </Field>
          <Field label="Avtalsstart" id="c-start">
            <Input
              id="c-start"
              type="date"
              value={values.contract_start}
              onChange={(e) => set({ contract_start: e.target.value })}
            />
          </Field>
          <Field label="Avtalsform" id="c-ctype">
            <Select value={values.contract_type} onValueChange={(v) => set({ contract_type: v })}>
              <SelectTrigger id="c-ctype">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_CONTRACT_TYPES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status" id="c-status">
            <Select value={values.status} onValueChange={(v) => set({ status: v })}>
              <SelectTrigger id="c-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_STATUS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Antal platser" id="c-seats">
            <Input
              id="c-seats"
              inputMode="numeric"
              value={values.seats}
              onChange={(e) => set({ seats: e.target.value.replace(/[^0-9]/g, "") })}
            />
          </Field>
          <Field label="Interna anteckningar" id="c-notes" wide>
            <Textarea
              id="c-notes"
              rows={3}
              value={values.internal_notes}
              onChange={(e) => set({ internal_notes: e.target.value })}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  wide,
  children,
}: {
  label: string;
  id: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
