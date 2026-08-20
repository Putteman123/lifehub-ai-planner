/**
 * Standardmodell för Andrea: OpenAI:s ChatGPT-modell via Lovable AI Gateway
 * (Responses API, med resonemang). Perplexity används separat för realtidssök.
 */
export const ANDREA_MODEL = "openai/gpt-5.6-sol";

/** Modell för korta bakgrundsanrop (insikter, förslag) utan resonemangsström. */
export const ANDREA_FAST_MODEL = "google/gemini-3.6-flash";

/**
 * Snabbfilen: Gemini Flash svarar direkt på enkla frågor och rutinåtgärder
 * med ett bantat verktygsset och komprimerat underlag.
 */
export const ANDREA_QUICK_MODEL = "google/gemini-3.7-flash";

/** Liten routermodell som avgör om turen ska gå snabbfil eller djupfil. */
export const ANDREA_ROUTER_MODEL = "google/gemini-3.1-flash-lite";
