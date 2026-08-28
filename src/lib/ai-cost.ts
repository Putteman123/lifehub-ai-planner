/**
 * Uppskattad kreditkostnad per Andrea-kommando.
 * Siffrorna är snitt från appens faktiska gateway-anrop (router + modell + röst).
 */
export type CommandCost = {
  id: string;
  label: string;
  /** Vad som faktiskt körs för kommandot. */
  chain: string;
  /** Uppskattad kostnad i krediter per kommando. */
  credits: number;
  /** Prioritet när saldot är lågt. */
  priority: "kör" | "vänta" | "spara";
  note: string;
};

export const COMMAND_COSTS: CommandCost[] = [
  {
    id: "router",
    label: "Vägval (varje fråga)",
    chain: "gemini-3.1-flash-lite",
    credits: 0.00005,
    priority: "kör",
    note: "Försumbar – körs alltid först för att välja fil.",
  },
  {
    id: "quick",
    label: "Snabb fråga / enkel åtgärd",
    chain: "router + gemini-3.7-flash",
    credits: 0.012,
    priority: "kör",
    note: "Lägg till uppgift, kolla saldo, boka händelse.",
  },
  {
    id: "deep",
    label: "Djup analys / flerstegsuppdrag",
    chain: "router + gpt-5.6-sol",
    credits: 0.05,
    priority: "vänta",
    note: "Dagskartläggning, ekonomianalys, långa resonemang – 4× dyrare än snabbfilen.",
  },
  {
    id: "voice",
    label: "Röstsvar (uppläsning)",
    chain: "ElevenLabs, annars gpt-4o-mini-tts",
    credits: 0.006,
    priority: "spara",
    note: "ElevenLabs kostar inga Lovable-krediter – fallback-rösten gör det.",
  },
  {
    id: "receipt",
    label: "Kvitto- eller filanalys (bild)",
    chain: "gemini-3.7-flash, multimodal",
    credits: 0.02,
    priority: "vänta",
    note: "Bilder drar många tokens in – samla flera kvitton och kör när saldot är påfyllt.",
  },
  {
    id: "proactive",
    label: "Proaktiv bevakning (bakgrund)",
    chain: "gemini-3.1-flash-lite",
    credits: 0.001,
    priority: "kör",
    note: "Billig – räknar fram flaggor för räkningar och krockar.",
  },
];

export const PRIORITY_LABEL: Record<CommandCost["priority"], string> = {
  kör: "Kör som vanligt",
  vänta: "Vänta vid lågt saldo",
  spara: "Stäng av för att spara",
};

/** Hur många kommandon av en typ som ryms i ett givet saldo. */
export function commandsPerCredit(cost: number, credits = 1): number {
  if (cost <= 0) return Infinity;
  return Math.floor(credits / cost);
}

export function formatCredits(value: number): string {
  if (value < 0.001) return `${value.toFixed(5)} kr.`;
  return `${value.toFixed(3)} kr.`;
}
