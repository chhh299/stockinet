import test from "node:test";
import assert from "node:assert/strict";
import { filterRelevantArticles, summarizeArticles } from "../lib/pipeline/summarize";

test("filterRelevantArticles returns all indices when no LLM key is configured", async () => {
  const originalEnv = { ...process.env };
  delete process.env.LLM_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  const articles = [
    { title: "Article 1", snippet: "Snippet 1" },
    { title: "Article 2", snippet: "Snippet 2" },
  ];

  const indices = await filterRelevantArticles("苹果", "AAPL", articles);
  assert.deepEqual(indices, [0, 1]);

  process.env = originalEnv;
});

test("summarizeArticles returns null when no LLM key is configured or titles empty", async () => {
  const originalEnv = { ...process.env };
  delete process.env.LLM_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  const res1 = await summarizeArticles("苹果", "AAPL", []);
  assert.equal(res1, null);

  const res2 = await summarizeArticles("苹果", "AAPL", ["Headline 1", "Headline 2"]);
  assert.equal(res2, null);

  process.env = originalEnv;
});
