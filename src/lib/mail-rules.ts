import type { Tables } from "@/integrations/supabase/types";

export type MailRuleRow = Tables<"mail_rules">;
export type MailRuleKind = "label" | "sender" | "keyword";
export type MailRuleMode = "include" | "exclude";

export const MAIL_RULE_KINDS: { value: MailRuleKind; label: string; hint: string }[] = [
  { value: "label", label: "Etikett", hint: "t.ex. Jobb, Viktigt" },
  { value: "sender", label: "Avsändare", hint: "t.ex. skolan@stad.se" },
  { value: "keyword", label: "Nyckelord", hint: "t.ex. faktura" },
];

function term(kind: string, value: string) {
  const v = value.trim();
  if (!v) return "";
  const quoted = /\s/.test(v) ? `"${v}"` : v;
  if (kind === "label") return `label:${quoted}`;
  if (kind === "sender") return `from:${quoted}`;
  return quoted;
}

/**
 * Bygger en Gmail-sökfråga utifrån basfrågan och användarens regler.
 * Inkluderande regler blir en OR-grupp, uteslutande regler blir negationer.
 */
export function buildGmailQuery(base: string, rules: MailRuleRow[]): string {
  const active = rules.filter((r) => r.is_active && r.value.trim());
  const includes = active
    .filter((r) => r.mode === "include")
    .map((r) => term(r.kind, r.value))
    .filter(Boolean);
  const excludes = active
    .filter((r) => r.mode === "exclude")
    .map((r) => term(r.kind, r.value))
    .filter(Boolean);

  const parts = [base.trim()].filter(Boolean);
  if (includes.length === 1) parts.push(includes[0]!);
  else if (includes.length > 1) parts.push(`(${includes.join(" OR ")})`);
  parts.push(...excludes.map((e) => `-${e}`));
  return parts.join(" ");
}

export function ruleLabel(rule: MailRuleRow) {
  const kind = MAIL_RULE_KINDS.find((k) => k.value === rule.kind)?.label ?? rule.kind;
  return `${rule.mode === "exclude" ? "Dölj" : "Visa"} · ${kind}: ${rule.value}`;
}
