import test from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonObject,
  extractJsonArray,
  buildChatCompletionPayload,
  resolveLlmConfig,
} from "../lib/llm/client";

test("resolveLlmConfig handles standard LLM_* env vars", () => {
  const env = {
    LLM_BASE_URL: "https://custom.llm.com/v1",
    LLM_API_KEY: "sk-test-custom",
    LLM_MODEL: "gpt-4o-mini",
    LLM_TEMPERATURE: "0.5",
    LLM_MAX_TOKENS: "500",
    LLM_TIMEOUT_MS: "15000",
    LLM_MAX_RETRIES: "2",
  };
  const config = resolveLlmConfig(env);
  assert.equal(config.baseUrl, "https://custom.llm.com/v1");
  assert.equal(config.apiKey, "sk-test-custom");
  assert.equal(config.model, "gpt-4o-mini");
  assert.equal(config.temperature, 0.5);
  assert.equal(config.maxTokens, 500);
  assert.equal(config.timeoutMs, 15000);
  assert.equal(config.maxRetries, 2);
});

test("resolveLlmConfig falls back to DEEPSEEK_API_KEY when LLM_API_KEY is not set", () => {
  const env = {
    DEEPSEEK_API_KEY: "sk-deepseek-test",
  };
  const config = resolveLlmConfig(env);
  assert.equal(config.baseUrl, "https://api.deepseek.com/v1");
  assert.equal(config.apiKey, "sk-deepseek-test");
  assert.equal(config.model, "deepseek-chat");
});

test("resolveLlmConfig returns null apiKey if neither is set", () => {
  const env = {};
  const config = resolveLlmConfig(env);
  assert.equal(config.apiKey, null);
});

test("cleanAndParseJson strips <think> tags and code fences", () => {
  const raw = `<think>
Analyzing the news headlines...
The company reported 20% revenue growth.
</think>
\`\`\`json
{
  "summary": "营收增长20%",
  "keyPoints": ["要点一", "要点二"]
}
\`\`\``;

  const res = extractJsonObject<{ summary: string; keyPoints: string[] }>(raw);
  assert.ok(res);
  assert.equal(res.summary, "营收增长20%");
  assert.deepEqual(res.keyPoints, ["要点一", "要点二"]);
});

test("extractJsonArray parses valid array with noise", () => {
  const raw = `Here are the relevant indices:
\`\`\`
[0, 2, 4]
\`\`\`
Hope this helps!`;
  const res = extractJsonArray<number>(raw);
  assert.ok(res);
  assert.deepEqual(res, [0, 2, 4]);
});

test("buildChatCompletionPayload correctly structures messages and parameters", () => {
  const payload = buildChatCompletionPayload("test prompt", {
    model: "qwen-2.5",
    temperature: 0.1,
    maxTokens: 300,
  });
  assert.equal(payload.model, "qwen-2.5");
  assert.equal(payload.temperature, 0.1);
  assert.equal(payload.max_tokens, 300);
  assert.deepEqual(payload.messages, [{ role: "user", content: "test prompt" }]);
});
