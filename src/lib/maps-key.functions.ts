import { createServerFn } from "@tanstack/react-start";

/**
 * Webbläsarnyckeln för Google Maps. Nyckeln är domänbegränsad hos Google,
 * så den är avsedd att synas i webbläsaren (precis som i kart-URL:er).
 */
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  const key =
    process.env["GOOGLE_API_KEY"] ??
    process.env["GOOGLE_MAPS_BROWSER_KEY"] ??
    process.env["GOOGLE_MAPS_OWN_KEY"] ??
    null;
  return { key };
});
