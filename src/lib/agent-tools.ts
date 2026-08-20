/**
 * Verktygsuppdelning för Andrea.
 *
 * QUICK_TOOL_NAMES: det bantade set snabbfilen (Gemini Flash) får se. Färre
 * verktyg = snabbare svar och färre felaktiga verktygsval.
 * SAFE_TOOL_NAMES: åtgärder som är ofarliga och lätta att ångra – de körs utan
 * manuellt godkännande i chatten.
 */

export const QUICK_TOOL_NAMES = [
  "goto",
  "find_item",
  "find_free_time",
  "create_event",
  "update_event",
  "create_todo",
  "update_todo",
  "complete_todo",
  "create_reminder",
  "update_reminder",
  "update_case_task",
  "add_shopping_items",
  "add_spend",
  "finance_overview",
  "suggest_category",
  "remember_about_me",
] as const;

export const SAFE_TOOL_NAMES = [
  "goto",
  "find_item",
  "find_free_time",
  "suggest_category",
  "finance_overview",
  "create_todo",
  "update_todo",
  "complete_todo",
  "create_reminder",
  "update_reminder",
  "update_case_task",
  "add_shopping_items",
  "add_pantry_items",
  "create_event",
  "remember_about_me",
] as const;

export const QUICK_TOOLS = new Set<string>(QUICK_TOOL_NAMES);
export const SAFE_TOOLS = new Set<string>(SAFE_TOOL_NAMES);
