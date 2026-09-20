import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface Props {
  orgName?: string;
  displayName?: string;
  roleLabel?: string;
  acceptUrl?: string;
}

const Email = ({ orgName, displayName, roleLabel, acceptUrl }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Du har blivit inbjuden till {orgName ?? "livo.health"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>livo.health</Text>
        <Heading style={h1}>Välkommen{displayName ? `, ${displayName}` : ""}!</Heading>
        <Text style={text}>
          Du har blivit inbjuden till {orgName ?? "en verksamhet"} i livo.health
          {roleLabel ? ` som ${roleLabel}` : ""}.
        </Text>
        <Text style={text}>
          Klicka på knappen nedan, logga in med den här e-postadressen, så kommer du in direkt.
        </Text>
        {acceptUrl ? (
          <Button href={acceptUrl} style={button}>
            Tacka ja till inbjudan
          </Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>Inbjudan gäller i sju dagar.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Inbjudan till ${typeof data["orgName"] === "string" && data["orgName"] ? data["orgName"] : "livo.health"}`,
  displayName: "Inbjudan till vårdorganisation",
  previewData: {
    orgName: "Hemtjänst Nord",
    displayName: "Anna Karlsson",
    roleLabel: "vårdpersonal",
    acceptUrl: "https://mellberg.online/invite/demo-token",
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
const button = {
  backgroundColor: "#2b2d5c",
  borderRadius: "12px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  padding: "12px 22px",
  textDecoration: "none",
};
const hr = { borderColor: "#e6e1d8", margin: "24px 0 12px" };
const footer = { color: "#8a8a95", fontSize: "12px", margin: "0" };
