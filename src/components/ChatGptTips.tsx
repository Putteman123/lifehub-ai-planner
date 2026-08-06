import { MessageSquareText } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";

const PROMPTS = [
  "Vad har jag för pass nästa vecka och när måste jag åka hemifrån?",
  "Lägg till mjölk, bröd och kaffe på inköpslistan.",
  "Skapa en uppgift: ringa försäkringsbolaget på fredag.",
  "Sammanfatta mina nattpass den här månaden och hur många timmar det blir.",
  "Var var jag i tisdags och hur länge?",
  "Boka in träning två timmar i den största luckan imorgon.",
];

/** Kort guide för hur ChatGPT (via appens MCP-koppling) kan användas mot LifeHub. */
export function ChatGptTips() {
  return (
    <SectionCard
      title="Så använder du ChatGPT mot LifeHub"
      icon={MessageSquareText}
      accent="text-nav-oversikt"
      tint="bg-nav-oversikt/12"
      collapsible
    >
      <p className="text-sm text-muted-foreground">
        När LifeHub är tillagd som connector i ChatGPT kan du styra kalender, uppgifter,
        inköpslista och platshistorik direkt i chatten. Prova till exempel:
      </p>
      <ul className="mt-3 space-y-2">
        {PROMPTS.map((p) => (
          <li
            key={p}
            className="rounded-xl bg-surface px-3 py-2.5 text-sm leading-relaxed"
          >
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Ändringar som ChatGPT gör kräver att du godkänner med PIN eller Face ID.
      </p>
    </SectionCard>
  );
}
