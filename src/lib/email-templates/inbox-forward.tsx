import React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface Props {
  contactName?: string;
  contactEmail?: string;
  orgName?: string;
  phone?: string;
  segment?: string;
  message?: string;
  inboxUrl?: string;
}

const Email = ({
  contactName,
  contactEmail,
  orgName,
  phone,
  segment,
  message,
  inboxUrl,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Ny förfrågan från livo.health</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>livo.health</Text>
        <Heading style={h1}>Ny förfrågan från sidan</Heading>
        <Text style={text}>
          <strong>{contactName ?? "Okänd"}</strong>
          {orgName ? ` – ${orgName}` : ""}
        </Text>
        <Text style={text}>E-post: {contactEmail ?? "–"}</Text>
        {phone ? <Text style={text}>Telefon: {phone}</Text> : null}
        {segment ? <Text style={text}>Verksamhetstyp: {segment}</Text> : null}
        {message ? <Text style={quote}>{message}</Text> : null}
        {inboxUrl ? <Text style={text}>Öppna i inkorgen: {inboxUrl}</Text> : null}
        <Hr style={hr} />
        <Text style={footer}>Svara på det här mejlet så går svaret direkt till avsändaren.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Ny förfrågan: ${(data["orgName"] as string) || (data["contactName"] as string) || "livo.health"}`,
  displayName: "Vidarebefordrad förfrågan",
  previewData: {
    contactName: "Anna Karlsson",
    contactEmail: "anna@hemtjanstnord.se",
    orgName: "Hemtjänst Nord",
    phone: "070-123 45 67",
    segment: "Hemtjänst",
    message: "Vi vill se hur schemat fungerar.",
    inboxUrl: "https://livo.health/v/inkorg",
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
const h1 = { color: "#2b2d5c", fontSize: "22px", margin: "0 0 12px" };
const text = { color: "#3a3a46", fontSize: "15px", lineHeight: "23px", margin: "0 0 8px" };
const quote = {
  backgroundColor: "#f5f2ec",
  borderRadius: "14px",
  color: "#3a3a46",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "12px 0",
  padding: "14px 18px",
  whiteSpace: "pre-wrap" as const,
};
const hr = { borderColor: "#e6e1d8", margin: "24px 0 12px" };
const footer = { color: "#8a8a95", fontSize: "12px", margin: "0" };
