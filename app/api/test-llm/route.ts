import { NextResponse } from "next/server";
import { resolveLlmConfig, callLlmChat } from "@/lib/llm/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = resolveLlmConfig();

  const maskedKey = config.apiKey
    ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)} (length: ${config.apiKey.length})`
    : "未配置 (null)";

  const endpoint = `${config.baseUrl}/chat/completions`;
  const info = {
    status: "testing",
    endpoint,
    resolvedConfig: {
      baseUrl: config.baseUrl,
      model: config.model,
      apiKeyMasked: maskedKey,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    },
    rawResponse: null as unknown,
    error: null as string | null,
  };

  if (!config.apiKey) {
    info.status = "no_key";
    info.error = "未检测到 LLM_API_KEY 或 DEEPSEEK_API_KEY 环境变量，请在 Vercel 中检查是否配置并在 Production 生效。";
    return NextResponse.json(info, { status: 200 });
  }

  try {
    const t0 = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 20,
      }),
    });

    const status = res.status;
    const bodyText = await res.text();
    const elapsedMs = Date.now() - t0;

    info.rawResponse = {
      httpStatus: status,
      bodyPreview: bodyText.slice(0, 500),
      elapsedMs,
    };

    if (res.ok) {
      info.status = "success";
    } else {
      info.status = "failed";
      info.error = `HTTP ${status}: ${bodyText.slice(0, 300)}`;
    }
  } catch (err) {
    info.status = "exception";
    info.error = String(err);
  }

  return NextResponse.json(info, { status: 200 });
}
