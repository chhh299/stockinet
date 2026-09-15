export interface LlmConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
}

export function resolveLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const apiKey = env.LLM_API_KEY || env.DEEPSEEK_API_KEY || null;

  // If using DEEPSEEK_API_KEY fallback and LLM_BASE_URL is not set
  const defaultBaseUrl = env.LLM_API_KEY
    ? "https://api.openai.com/v1"
    : env.DEEPSEEK_API_KEY
    ? "https://api.deepseek.com/v1"
    : "https://api.openai.com/v1";

  let rawBaseUrl = (env.LLM_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  // 自动容错：如果填写的 BaseURL 缺少 /v1，自动智能补齐 /v1，防止拼成 404
  if (!rawBaseUrl.endsWith("/v1") && !rawBaseUrl.includes("/v1/")) {
    rawBaseUrl = `${rawBaseUrl}/v1`;
  }
  const baseUrl = rawBaseUrl;

  const defaultModel = env.LLM_API_KEY
    ? "gpt-4o-mini"
    : env.DEEPSEEK_API_KEY
    ? "deepseek-chat"
    : "gpt-4o-mini";

  const model = env.LLM_MODEL || defaultModel;
  const temperature = env.LLM_TEMPERATURE ? parseFloat(env.LLM_TEMPERATURE) : 0.2;
  const maxTokens = env.LLM_MAX_TOKENS ? parseInt(env.LLM_MAX_TOKENS, 10) : 800;
  const timeoutMs = env.LLM_TIMEOUT_MS ? parseInt(env.LLM_TIMEOUT_MS, 10) : 20000;
  const maxRetries = env.LLM_MAX_RETRIES ? parseInt(env.LLM_MAX_RETRIES, 10) : 3;

  return {
    baseUrl,
    apiKey,
    model,
    temperature,
    maxTokens,
    timeoutMs,
    maxRetries,
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionPayload {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
}

export function buildChatCompletionPayload(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): ChatCompletionPayload {
  const messages: ChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  return {
    model: options.model || "gpt-4o-mini",
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 800,
  };
}

export function cleanRawText(raw: string): string {
  if (!raw) return "";
  // Strip <think>...</think> tags commonly produced by reasoning models (e.g. DeepSeek-R1)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences if wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  return cleaned;
}

export function extractJsonObject<T = unknown>(raw: string): T | null {
  const cleaned = cleanRawText(raw);
  // Match innermost or outer JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Attempt minor repair like trailing commas before }
    try {
      const repaired = match[0].replace(/,\s*([\}\]])/g, "$1");
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

export function extractJsonArray<T = unknown>(raw: string): T[] | null {
  const cleaned = cleanRawText(raw);
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;

  try {
    const res = JSON.parse(match[0]);
    return Array.isArray(res) ? (res as T[]) : null;
  } catch {
    try {
      const repaired = match[0].replace(/,\s*([\}\]])/g, "$1");
      const res = JSON.parse(repaired);
      return Array.isArray(res) ? (res as T[]) : null;
    } catch {
      return null;
    }
  }
}

export const cleanAndParseJson = {
  extractJsonObject,
  extractJsonArray,
  cleanRawText,
};

export async function callLlmChat(
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
): Promise<string | null> {
  const config = resolveLlmConfig();
  if (!config.apiKey) {
    return null;
  }

  const endpoint = `${config.baseUrl}/chat/completions`;
  const payload = buildChatCompletionPayload(prompt, {
    model: config.model,
    temperature: options.temperature ?? config.temperature,
    maxTokens: options.maxTokens ?? config.maxTokens,
    systemPrompt: options.systemPrompt,
  });

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        return content?.trim() || null;
      }

      const errorText = await res.text().catch(() => "");
      console.error(`[LLM Error] HTTP ${res.status} from ${endpoint} (model: ${config.model}):`, errorText.slice(0, 300));

      // Retry on 429 or 5xx server errors
      if ((res.status === 429 || res.status >= 500) && attempt < config.maxRetries - 1) {
        const jitter = Math.random() * 300;
        const backoff = Math.min(1000 * Math.pow(2, attempt) + jitter, 8000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      return null;
    } catch (fetchErr) {
      clearTimeout(timer);
      console.error(`[LLM Network Exception] attempt ${attempt + 1}/${config.maxRetries}:`, String(fetchErr));
      if (attempt < config.maxRetries - 1) {
        const jitter = Math.random() * 300;
        const backoff = Math.min(500 * Math.pow(2, attempt) + jitter, 5000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return null;
    }
  }

  return null;
}
