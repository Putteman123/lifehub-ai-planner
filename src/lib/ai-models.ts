/** Google AI Studios aktuella stabila Gemini-modell för hela Andrea. */
export const ANDREA_MODEL = "gemini-3.6-flash";

/** Korta bakgrundsanrop använder samma aktuella modell och samma betalda konto. */
export const ANDREA_FAST_MODEL = ANDREA_MODEL;

/**
 * Snabbfilen: Gemini Flash svarar direkt på enkla frågor och rutinåtgärder
 * med ett bantat verktygsset och komprimerat underlag.
 */
export const ANDREA_QUICK_MODEL = ANDREA_MODEL;

/** Liten routermodell som avgör om turen ska gå snabbfil eller djupfil. */
export const ANDREA_ROUTER_MODEL = ANDREA_MODEL;

/** Reservmodell via Lovable AI om Google har ett tillfälligt driftfel. */
export const ANDREA_FALLBACK_MODEL = "google/gemini-3.7-flash";

/** Modell-id som gäller när anropet går via Lovable AI-gatewayen. */
export const ANDREA_GATEWAY_MODEL = ANDREA_FALLBACK_MODEL;
