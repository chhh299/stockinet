import { callLlmChat, extractJsonArray, extractJsonObject, resolveLlmConfig } from "../llm/client";

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
}

// ---- Relevance filter ----

export async function filterRelevantArticles(
  stockNameCn: string,
  symbol: string,
  articles: { title: string; snippet: string }[]
): Promise<number[]> {
  const config = resolveLlmConfig();
  if (!config.apiKey || articles.length === 0) return articles.map((_, i) => i);

  const articleList = articles
    .map((a, i) => `${i}. ${a.title} — ${(a.snippet || "").slice(0, 200)}`)
    .join("\n");

  const prompt = `You are filtering financial news. For the list below, identify which articles are ACTUALLY about ${stockNameCn} (${symbol}).
Exclude articles that are:
- About a completely different company or industry
- Generic market commentary that only mentions ${symbol} in passing
- Unrelated financial news matched by keyword error

Return ONLY a JSON array of indices (0-based) that are relevant and should be kept.
Example: [0, 3, 7]

Articles:
${articleList}`;

  try {
    const text = await callLlmChat(prompt, { maxTokens: 300 });
    if (!text) return articles.map((_, i) => i);
    const indices = extractJsonArray<number>(text);
    if (!indices) return articles.map((_, i) => i);
    const filtered = indices.filter((i) => typeof i === "number" && i >= 0 && i < articles.length);
    return filtered.length > 0 ? filtered : articles.map((_, i) => i);
  } catch {
    // On failure, keep all articles
    return articles.map((_, i) => i);
  }
}

// ---- AI Summarization ----

export async function summarizeArticles(
  stockNameCn: string,
  symbol: string,
  titles: string[]
): Promise<SummaryResult | null> {
  const config = resolveLlmConfig();
  if (!config.apiKey || titles.length === 0) return null;

  const titleList = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const prompt = `You are a senior financial news analyst. Analyze these headlines about ${stockNameCn} (${symbol}).

Your task:
1. Identify the 1-2 most important and factually reliable headlines
2. Distill the key facts (ignore speculation, hype, or generic commentary)
3. If the headlines are contradictory or unreliable, say so honestly
4. Focus on: earnings, product launches, regulatory actions, M&A, market-moving events

Return ONLY a JSON object (no markdown, no extra text):
{
  "summary": "1-2 sentence Chinese summary of the key factual information",
  "keyPoints": ["bullet 1 in Chinese", "bullet 2 in Chinese"]
}

Headlines:
${titleList}`;

  try {
    const text = await callLlmChat(prompt, { maxTokens: 600 });
    if (!text) return null;

    const parsed = extractJsonObject<{ summary?: string; keyPoints?: string[] }>(text);
    if (!parsed) return null;

    return {
      summary: parsed.summary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 3) : [],
    };
  } catch {
    return null;
  }
}
