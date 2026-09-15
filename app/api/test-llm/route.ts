import { NextResponse } from "next/server";
import { resolveLlmConfig, callLlmChat } from "@/lib/llm/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = resolveLlmConfig();

  const maskedKey = config.apiKey
    ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)} (length: ${config.apiKey.length})`
    : "未配置 (null)";

  const info = {
    status: "testing",
    resolvedConfig: {
      baseUrl: config.baseUrl,
      model: config.model,
      apiKeyMasked: maskedKey,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    },
    testResult: null as unknown,
    error: null as string | null,
  };

  if (!config.apiKey) {
    info.status = "no_key";
    info.error = "未检测到 LLM_API_KEY 或 DEEPSEEK_API_KEY 环境变量，请在 Vercel 中检查是否配置并在 Production 生效。";
    return NextResponse.json(info, { status: 200 });
  }

  try {
    const t0 = Date.now();
    const reply = await callLlmChat("你是一个金融助手。请仅回复：连接成功。", {
      maxTokens: 50,
    });
    const elapsedMs = Date.now() - t0;

    if (reply) {
      info.status = "success";
      info.testResult = {
        reply,
        elapsedMs,
      };
    } else {
      info.status = "failed";
      info.error = "模型请求已发送，但未收到有效回复（可能是 model 名字不匹配、URL 末尾缺少 /v1、或者网络受限，请在 Vercel Runtime Logs 查看 [LLM Error] 详细报错）";
    }
  } catch (err) {
    info.status = "exception";
    info.error = String(err);
  }

  return NextResponse.json(info, { status: 200 });
}
