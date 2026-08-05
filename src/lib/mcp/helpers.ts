import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function textResult(text: string, structured?: Record<string, unknown>): ToolResult {
  return structured
    ? { content: [{ type: "text", text }], structuredContent: structured }
    : { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Kräver en verifierad användare och ger tillbaka klient + användar-id. */
export function requireUser(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) return null;
  const userId = ctx.getUserId();
  if (!userId) return null;
  return { supabase: supabaseForUser(ctx), userId };
}

export function isoDate(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Ogiltigt datum i ${field}: ${value}`);
  return date.toISOString();
}
