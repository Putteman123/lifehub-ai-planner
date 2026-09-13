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
  title?: string;
  message?: string;
  dueLabel?: string;
  amountLabel?: string;
  items?: { label: string; due?: string }[];
}

const Email = ({ title, message, dueLabel, amountLabel, items = [] }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{title ?? "Påminnelse från LifeHub"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>LifeHub AI</Text>
        <Heading style={h1}>{title ?? "Påminnelse"}</Heading>
        {message ? <Text style={text}>{message}</Text> : null}

        {dueLabel || amountLabel ? (
          <Section style={box}>
            {dueLabel ? <Text style={row}>Förfaller: {dueLabel}</Text> : null}
            {amountLabel ? <Text style={row}>Belopp: {amountLabel}</Text> : null}
          </Section>
        ) : null}

        {items.length > 0 ? (
          <Section style={box}>
            {items.map((i) => (
              <Text key={i.label} style={row}>
                • {i.label}
                {i.due ? ` – ${i.due}` : ""}
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
  subject: (data: Record<string, unknown>) =>
    typeof data["title"] === "string" && data["title"]
      ? `Påminnelse: ${data["title"]}`
      : "Påminnelse från LifeHub",
  displayName: "Påminnelse",
  previewData: {
    title: "Elräkningen förfaller snart",
    message: "Din fasta utgift Elräkning är fortfarande obetald.",
    dueLabel: "2026-09-15",
    amountLabel: "1 240 kr",
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
const h1 = { color: "#2b2d5c", fontSize: "23px", margin: "0 0 12px" };
const text = { color: "#3a3a46", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" };
const box = {
  backgroundColor: "#f5f2ec",
  borderRadius: "14px",
  padding: "14px 18px",
  margin: "12px 0",
};
const row = { color: "#3a3a46", fontSize: "14px", lineHeight: "22px", margin: "0 0 4px" };
const hr = { borderColor: "#e6e1d8", margin: "24px 0 12px" };
const footer = { color: "#8a8a95", fontSize: "12px", margin: "0" };
