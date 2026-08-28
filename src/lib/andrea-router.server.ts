import { completeText } from "@/lib/ai-complete.server";
import { ANDREA_ROUTER_MODEL } from "@/lib/ai-models";

export type AndreaLane = "quick" | "deep";

const ROUTER_SYSTEM = `Du är en router i appen LifeHub. Avgör om Patricks senaste meddelande ska hanteras av:
- "quick": korta statusfrågor (vad händer idag/imorgon), bocka av eller skapa en uppgift/todo/påminnelse, registrera ett köp, lägga till inköpsvara, navigera i appen, korta uppföljningar och småprat.
- "deep": planering över tid, analys, jämförelser, juridiska resonemang, ekonomiöversikter, kassaskåpet, mejl/dokument, bifogade filer, flerstegsuppdrag eller när meddelandet är tvetydigt.
Vid minsta tvekan: svara "deep".
Svara ENDAST med ordet quick eller deep.`;

/**
 * Klassificerar turen med ett litet Gemini-anrop. Vid fel eller otydligt svar
 * faller vi tillbaka på djupfilen så att kvaliteten aldrig sänks av routern.
 */
export async function routeAndreaTurn(opts: {
  apiKey?: string;
  lastUserText: string;
  hasAttachments: boolean;
}): Promise<AndreaLane> {
  const text = opts.lastUserText.trim();
  if (!text || opts.hasAttachments) return "deep";
  if (text.length > 400) return "deep";

  try {
    const answer = await completeText({
      apiKey: opts.apiKey,
      model: ANDREA_ROUTER_MODEL,
      system: ROUTER_SYSTEM,
      input: text,
    });
    return answer.toLowerCase().includes("quick") ? "quick" : "deep";
  } catch {
    return "deep";
  }
}
