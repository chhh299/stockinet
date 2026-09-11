import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getHermesNews } from "../app/api/v1/hermes/news/route";
import { GET as getHermesStocks, POST as postHermesStock } from "../app/api/v1/hermes/stocks/route";
import { prisma } from "../lib/db";

// Global stub setup for Prisma
const originalCount = prisma.stock.count;
const originalFindMany = prisma.stock.findMany;
const originalFindUnique = prisma.stock.findUnique;
const originalCreate = prisma.stock.create;
const originalUpdate = prisma.stock.update;
const originalClusterFindMany = prisma.newsCluster.findMany;
const originalClusterFindFirst = prisma.newsCluster.findFirst;

test.beforeEach(() => {
  prisma.stock.count = (async () => 10) as unknown as typeof prisma.stock.count;
});

test.afterEach(() => {
  prisma.stock.count = originalCount;
  prisma.stock.findMany = originalFindMany;
  prisma.stock.findUnique = originalFindUnique;
  prisma.stock.create = originalCreate;
  prisma.stock.update = originalUpdate;
  prisma.newsCluster.findMany = originalClusterFindMany;
  prisma.newsCluster.findFirst = originalClusterFindFirst;
  delete process.env.HERMES_API_KEY;
});

test("Hermes API enforces Bearer token authentication across routes", async () => {
  process.env.HERMES_API_KEY = "hermes-secret-123";

  // 1. Missing header
  const reqNoAuth = new NextRequest("http://localhost/api/v1/hermes/news");
  const resNoAuth = await getHermesNews(reqNoAuth);
  assert.equal(resNoAuth.status, 401);
  const dataNoAuth = await resNoAuth.json();
  assert.equal(dataNoAuth.code, 401);

  // 2. Wrong Bearer token
  const reqWrongAuth = new NextRequest("http://localhost/api/v1/hermes/stocks", {
    headers: { Authorization: "Bearer wrong-key" },
  });
  const resWrongAuth = await getHermesStocks(reqWrongAuth);
  assert.equal(resWrongAuth.status, 401);

  // 3. Valid Bearer token
  prisma.stock.findMany = (async () => []) as unknown as typeof prisma.stock.findMany;
  const reqValidAuth = new NextRequest("http://localhost/api/v1/hermes/stocks", {
    headers: { Authorization: "Bearer hermes-secret-123" },
  });
  const resValidAuth = await getHermesStocks(reqValidAuth);
  assert.equal(resValidAuth.status, 200);
});

test("GET /api/v1/hermes/news formats structured news response with verification and sources", async () => {
  const mockCluster = {
    id: 101,
    title: "英伟达业绩大超预期",
    aiSummary: "英伟达数据中心收入翻倍增长。",
    keyPoints: ["云厂商算力投资激增", "毛利率稳定在75%"],
    verificationStatus: "verified",
    sourceCount: 2,
    publishedAt: new Date("2026-09-10T10:00:00Z"),
    createdAt: new Date(),
    articles: [
      {
        article: {
          id: 201,
          title: "英伟达Q2营收创新高",
          url: "https://eastmoney.com/a/201",
          source: "eastmoney" as const,
          stockId: 1,
          publishedAt: new Date("2026-09-10T09:30:00Z"),
        },
      },
      {
        article: {
          id: 202,
          title: "NVIDIA reports record quarterly revenue",
          url: "https://finance.yahoo.com/m/202",
          source: "yahoo" as const,
          stockId: 1,
          publishedAt: new Date("2026-09-10T09:35:00Z"),
        },
      },
    ],
  };

  prisma.newsCluster.findMany = (async () => [mockCluster]) as unknown as typeof prisma.newsCluster.findMany;
  prisma.stock.findUnique = (async () => ({
    id: 1,
    symbol: "NVDA",
    name: "NVIDIA Corp",
    nameCn: "英伟达",
    market: "US",
    price: 130.5,
    changePct: 4.2,
    isActive: true,
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as unknown as typeof prisma.stock.findUnique;

  const req = new NextRequest("http://localhost/api/v1/hermes/news?symbol=NVDA&verified=true");
  const res = await getHermesNews(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.code, 0);
  assert.equal(json.message, "success");
  assert.ok(json.data.items);
  assert.equal(json.data.items.length, 1);

  const item = json.data.items[0];
  assert.equal(item.id, 101);
  assert.equal(item.title, "英伟达业绩大超预期");
  assert.equal(item.verificationStatus, "verified");
  assert.equal(item.sourceCount, 2);
  assert.equal(item.stock.symbol, "NVDA");
  assert.equal(item.sources.length, 2);
  assert.equal(item.sources[0].name, "eastmoney");
  assert.equal(item.sources[1].name, "yahoo");
  assert.ok(json.meta.serverTime);
});

test("POST /api/v1/hermes/stocks validates input and creates or reactivates stocks", async () => {
  // 1. Validation error: missing nameCn
  const reqInvalid = new NextRequest("http://localhost/api/v1/hermes/stocks", {
    method: "POST",
    body: JSON.stringify({ symbol: "300750.SZ", market: "CN" }),
  });
  const resInvalid = await postHermesStock(reqInvalid);
  assert.equal(resInvalid.status, 400);
  const dataInvalid = await resInvalid.json();
  assert.equal(dataInvalid.code, 400);

  // 2. Conflict error: symbol already active
  prisma.stock.findUnique = (async () => ({
    id: 5,
    symbol: "300750.SZ",
    isActive: true,
  })) as unknown as typeof prisma.stock.findUnique;

  const reqConflict = new NextRequest("http://localhost/api/v1/hermes/stocks", {
    method: "POST",
    body: JSON.stringify({
      symbol: "300750.SZ",
      nameCn: "宁德时代",
      market: "CN",
    }),
  });
  const resConflict = await postHermesStock(reqConflict);
  assert.equal(resConflict.status, 409);
  const dataConflict = await resConflict.json();
  assert.equal(dataConflict.code, 409);

  // 3. Success creation: new symbol
  prisma.stock.findUnique = (async () => null) as unknown as typeof prisma.stock.findUnique;
  prisma.stock.create = (async (args: { data: Record<string, unknown> }) => ({
    id: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
    price: null,
    changePct: null,
    ...args.data,
  })) as unknown as typeof prisma.stock.create;

  const reqCreate = new NextRequest("http://localhost/api/v1/hermes/stocks", {
    method: "POST",
    body: JSON.stringify({
      symbol: "002594.SZ",
      nameCn: "比亚迪",
      market: "CN",
    }),
  });
  const resCreate = await postHermesStock(reqCreate);
  assert.equal(resCreate.status, 201);
  const dataCreate = await resCreate.json();
  assert.equal(dataCreate.code, 0);
  assert.equal(dataCreate.data.symbol, "002594.SZ");
  assert.equal(dataCreate.data.isCustom, true);
});
