/**
 * Perplexity-sökning för Andrea. Använder användarens egna Perplexity-konto
 * (PERPLEXITY_API_KEY från connectorn) och returnerar svar + källor.
 */
export type WebSearchResult = {
  answer: string;
  sources: string[];
  model: string;
};

export async function searchWeb(
  query: string,
  mode: "web" | "academic" = "web",
): Promise<WebSearchResult> {
  const keys = [process.env["PERPLEXITY_API_KEY_1"], process.env["PERPLEXITY_API_KEY"]].filter(
    (k): k is string => Boolean(k),
  );
  if (keys.length === 0) throw new Error("Perplexity är inte kopplat.");

  let lastError: Error | null = null;
  for (const key of keys) {
    try {
      return await searchWithKey(key, query, mode);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Perplexity-nyckel misslyckades, provar nästa om det finns: ${lastError.message}`);
    }
  }
  throw lastError ?? new Error("Perplexity är inte kopplat.");
}

async function searchWithKey(
  key: string,
  query: string,
  mode: "web" | "academic",
): Promise<WebSearchResult> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      search_mode: mode === "academic" ? "academic" : undefined,
      messages: [
        {
          role: "system",
          content:
            "Svara kort och konkret på svenska. Max 6 meningar. Ta med datum och siffror när det är relevant.",
        },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && body.includes("insufficient_quota")) {
      throw new Error(
        "Perplexity-kontots API-krediter är slut. Fyll på på console.perplexity.ai (API-krediter är separata från Pro-abonnemanget).",
      );
    }
    throw new Error(`Perplexity-anrop misslyckades [${res.status}]: ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
    search_results?: { url?: string }[];
  };

  const sources =
    data.citations ??
    (data.search_results ?? [])
      .map((r) => r.url)
      .filter((u): u is string => typeof u === "string");

  return {
    answer: data.choices?.[0]?.message?.content ?? "",
    sources: sources.slice(0, 6),
    model: "sonar-pro",
  };
}
