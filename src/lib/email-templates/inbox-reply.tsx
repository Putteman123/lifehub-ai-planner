import React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface Props {
  contactName?: string;
  message?: string;
}

const Email = ({ contactName, message }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Svar från livo.health</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>livo.health</Text>
        <Heading style={h1}>Hej{contactName ? ` ${contactName}` : ""}!</Heading>
        <Text style={quote}>{message ?? ""}</Text>
        <Hr style={hr} />
        <Text style={footer}>livo.health – Digital Omsorgslösning</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    (data["subject"] as string) || "Svar från livo.health",
  displayName: "Svar från inkorgen",
  previewData: {
    contactName: "Anna",
    message: "Tack för din förfrågan! Passar det med en demo på torsdag klockan 10?",
    subject: "Svar från livo.health",
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
const quote = {
  color: "#3a3a46",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 12px",
  whiteSpace: "pre-wrap" as const,
};
const hr = { borderColor: "#e6e1d8", margin: "24px 0 12px" };
const footer = { color: "#8a8a95", fontSize: "12px", margin: "0" };
