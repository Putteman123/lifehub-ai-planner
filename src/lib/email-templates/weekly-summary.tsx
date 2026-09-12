import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  weekLabel?: string;
  spent?: number;
  diff?: number;
  topCategories?: { category: string; amount: number }[];
  unpaid?: string[];
  actions?: string[];
  summary?: string;
}

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";

const Email = ({
  name,
  weekLabel,
  spent = 0,
  diff = 0,
  topCategories = [],
  unpaid = [],
  actions = [],
  summary,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Veckans läge: ${kr(spent)} spenderat`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>LifeHub AI</Text>
        <Heading style={h1}>Veckosammanfattning{weekLabel ? ` – ${weekLabel}` : ""}</Heading>
        <Text style={text}>{name ? `Hej ${name},` : "Hej,"} här är veckan i korthet.</Text>

        <Section style={box}>
          <Text style={label}>Spenderat denna vecka</Text>
          <Text style={big}>{kr(spent)}</Text>
          <Text style={label}>
            Mot förra veckan: {diff >= 0 ? "+" : ""}
            {kr(diff)}
          </Text>
        </Section>

        {topCategories.length > 0 ? (
          <Section>
            <Text style={h2}>Största kategorier</Text>
            {topCategories.map((c) => (
              <Text key={c.category} style={row}>
                {c.category} – {kr(c.amount)}
              </Text>
            ))}
          </Section>
        ) : null}

        {unpaid.length > 0 ? (
          <Section>
            <Text style={h2}>Obetalt denna månad</Text>
            <Text style={row}>{unpaid.join(", ")}</Text>
          </Section>
        ) : null}

        {summary ? <Text style={text}>{summary}</Text> : null}

        {actions.length > 0 ? (
          <Section>
            <Text style={h2}>Att göra</Text>
            {actions.map((a) => (
              <Text key={a} style={row}>
                • {a}
              </Text>
            ))}
          </Section>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>Skickat av Andrea i LifeHub AI.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Din veckosammanfattning från LifeHub",
  displayName: "Veckosammanfattning",
  previewData: {
    name: "Patrick",
    weekLabel: "v. 37",
    spent: 4210,
    diff: -530,
    topCategories: [
      { category: "Mat", amount: 1890 },
      { category: "Transport", amount: 940 },
    ],
    unpaid: ["Hyra", "Elräkning"],
    actions: ["Betala elräkningen", "Boka bilservice"],
    summary: "Lugnare vecka än förra. Maten är fortsatt största posten.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const brand = {
  color: "#d06a37",
  fontSize: "12px",
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  margin: "0 0 6px",
};
const h1 = { color: "#2b2d5c", fontSize: "24px", margin: "0 0 12px" };
const h2 = { color: "#2b2d5c", fontSize: "15px", fontWeight: 700, margin: "20px 0 6px" };
const text = { color: "#3a3a46", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const box = {
  backgroundColor: "#f5f2ec",
  borderRadius: "14px",
  padding: "16px 18px",
  margin: "12px 0",
};
const label = { color: "#6b6b78", fontSize: "13px", margin: "0" };
const big = { color: "#2b2d5c", fontSize: "26px", fontWeight: 700, margin: "4px 0" };
const row = { color: "#3a3a46", fontSize: "14px", lineHeight: "22px", margin: "0 0 4px" };
const hr = { borderColor: "#e6e1d8", margin: "24px 0 12px" };
const footer = { color: "#8a8a95", fontSize: "12px", margin: "0" };
