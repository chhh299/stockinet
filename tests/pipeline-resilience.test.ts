import test from "node:test";
import assert from "node:assert/strict";
import { groupSimilarArticles } from "../lib/pipeline/dedup";
import { summarizeArticles } from "../lib/pipeline/summarize";
import { RawArticle, SourceAdapter } from "../lib/sources/types";

test("Single adapter error isolation: Promise.allSettled preserves articles from healthy sources", async () => {
  const healthyAdapter: SourceAdapter = {
    id: "eastmoney",
    name: "东方财富",
    supportsMarket: () => true,
    fetch: async () => [
      {
        title: "健康源测试新闻，内容详实且丰富",
        snippet: "这是来自正常数据源的内容",
        url: "https://eastmoney.com/test1",
        source: "eastmoney",
        publishedAt: new Date(),
        stockId: 1,
      },
    ],
  };

  const failingAdapter: SourceAdapter = {
    id: "cls",
    name: "财联社",
    supportsMarket: () => true,
    fetch: async () => {
      throw new Error("Network timeout / Connection reset");
    },
  };

  const adapters = [healthyAdapter, failingAdapter];
  const allRawArticles: RawArticle[] = [];
  const errors: string[] = [];

  const results = await Promise.allSettled(
    adapters.map((a) =>
      a.fetch({
        symbol: "600519.SS",
        name: "Kweichow Moutai",
        nameCn: "贵州茅台",
        market: "CN",
        stockId: 1,
      })
    )
  );

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const adapter = adapters[i];
    if (res.status === "fulfilled") {
      allRawArticles.push(...res.value);
    } else {
      errors.push(`Fetch error via ${adapter.id}: ${res.reason}`);
    }
  }

  // Verify failure in failingAdapter didn't affect healthyAdapter
  assert.equal(allRawArticles.length, 1);
  assert.equal(allRawArticles[0].title, "健康源测试新闻，内容详实且丰富");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Network timeout/);
});

test("Multi-source clustering verification status logic", () => {
  // Scenario 1: English articles with high space-separated word overlap
  const articlesMultiSource: RawArticle[] = [
    {
      title: "Apple launches new iPhone 18 Pro flagship smartphone today",
      snippet: "Apple announced hardware devices",
      url: "https://source1.com/a1",
      source: "googlenews",
      publishedAt: new Date(),
      stockId: 1,
    },
    {
      title: "Apple launches new iPhone 18 Pro flagship smartphone device",
      snippet: "Apple hardware news",
      url: "https://source2.com/a2",
      source: "yahoo",
      publishedAt: new Date(),
      stockId: 1,
    },
  ];

  const groups = groupSimilarArticles(articlesMultiSource);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].articles.length, 2);

  const sources = new Set(groups[0].articles.map((a) => a.source));
  const verificationStatus = sources.size >= 2 ? "verified" : "unverified";
  assert.equal(verificationStatus, "verified");
  assert.equal(sources.size, 2);

  // Scenario 2: Single source -> unverified
  const singleSourceArticles: RawArticle[] = [
    {
      title: "Apple releases quarterly financial results with strong revenue",
      snippet: "Exclusive financial news",
      url: "https://source1.com/single",
      source: "googlenews",
      publishedAt: new Date(),
      stockId: 1,
    },
  ];
  const singleGroups = groupSimilarArticles(singleSourceArticles);
  assert.equal(singleGroups.length, 1);
  const singleSources = new Set(singleGroups[0].articles.map((a) => a.source));
  const singleVerification = singleSources.size >= 2 ? "verified" : "unverified";
  assert.equal(singleVerification, "unverified");
  assert.equal(singleSources.size, 1);
});

test("summarizeArticles handles malformed LLM response gracefully without throwing", async () => {
  // When LLM returns non-JSON or broken text
  const originalEnv = { ...process.env };
  process.env.LLM_API_KEY = "dummy-key";

  // Mock global fetch to return malformed output from LLM endpoint
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "抱歉，由于模型负荷，无法输出规范JSON。" } }],
      }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    const summaryResult = await summarizeArticles("贵州茅台", "600519.SS", [
      "茅台业绩稳健增长",
    ]);
    // Should gracefully return null rather than crashing
    assert.equal(summaryResult, null);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
