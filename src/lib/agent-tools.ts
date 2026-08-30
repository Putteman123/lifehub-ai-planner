/**
 * Behörighetsmodell för Andreas verktyg.
 *
 * Utgångsläge: Andrea får göra allt direkt – utom att radera. Radering (och
 * utgående mejl) kräver fortfarande ett manuellt ja i chatten.
 */

/** Verktyg som alltid kräver Patricks godkännande innan de körs. */
export const APPROVAL_TOOL_NAMES = [
  "delete_event",
  "delete_todo",
  "delete_reminder",
  "delete_place",
  "delete_visit",
  "vault_delete",
  "send_mail",
] as const;

const APPROVAL_TOOLS = new Set<string>(APPROVAL_TOOL_NAMES);

/** Sant om verktyget får köras utan godkännande. */
export function isSafeTool(name: string) {
  return !APPROVAL_TOOLS.has(name) && !name.startsWith("delete_");
}
