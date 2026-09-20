import React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface Props {
  contactName?: string;
  orgName?: string;
  message?: string;
}

const Email = ({ contactName, orgName, message }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Tack för din intresseanmälan till livo.health</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>livo.health</Text>
        <Heading style={h1}>Tack{contactName ? `, ${contactName}` : ""}!</Heading>
        <Text style={text}>
          Vi har tagit emot din intresseanmälan{orgName ? ` för ${orgName}` : ""} och hör av oss
          inom kort för att boka en demo.
        </Text>
        {message ? <Text style={quote}>”{message}”</Text> : null}
        <Hr style={hr} />
        <Text style={footer}>livo.health – trygg planering för hemsjukvård.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Tack för din intresseanmälan – livo.health",
  displayName: "Bekräftelse intresseanmälan",
  previewData: {
    contactName: "Anna Karlsson",
    orgName: "Hemtjänst Nord",
    message: "Vi vill se hur schemat och medicinlistan fungerar.",
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
const quote = {
  backgroundColor: "#f5f2ec",
  borderRadius: "14px",
  color: "#3a3a46",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "12px 0",
  padding: "14px 18px",
};
const hr = { borderColor: "#e6e1d8", margin: "24px 0 12px" };
const footer = { color: "#8a8a95", fontSize: "12px", margin: "0" };
