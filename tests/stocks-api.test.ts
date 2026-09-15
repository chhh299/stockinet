import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as createStock, GET as getStocks } from "../app/api/stocks/route";
import { PATCH as patchStock, DELETE as deleteStock } from "../app/api/stocks/[id]/route";
import { prisma } from "../lib/db";
import { Stock, Market } from "@prisma/client";

// Global setup to stub prisma.stock.count so seedInitialStocks doesn't attempt network connection
const originalCount = prisma.stock.count;
const originalFindMany = prisma.stock.findMany;
const originalFindUnique = prisma.stock.findUnique;
const originalCreate = prisma.stock.create;
const originalUpdate = prisma.stock.update;
const originalDelete = prisma.stock.delete;

test.beforeEach(() => {
  prisma.stock.count = (async () => 1) as unknown as typeof prisma.stock.count;
});

test.afterEach(() => {
  prisma.stock.count = originalCount;
  prisma.stock.findMany = originalFindMany;
  prisma.stock.findUnique = originalFindUnique;
  prisma.stock.create = originalCreate;
  prisma.stock.update = originalUpdate;
  prisma.stock.delete = originalDelete;
});

test("POST /api/stocks validates required fields and invalid market", async () => {
  // 1. Missing symbol
  const req1 = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({ nameCn: "测试股票", market: "CN" }),
  });
  const res1 = await createStock(req1);
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.match(data1.error, /股票代码.*不能为空/);

  // 2. Empty symbol
  const req2 = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({ symbol: "   ", nameCn: "测试股票", market: "CN" }),
  });
  const res2 = await createStock(req2);
  assert.equal(res2.status, 400);

  // 3. Missing nameCn
  const req3 = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({ symbol: "TEST1", market: "CN" }),
  });
  const res3 = await createStock(req3);
  assert.equal(res3.status, 400);
  const data3 = await res3.json();
  assert.match(data3.error, /中文简称.*不能为空/);

  // 4. Invalid market
  const req4 = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({ symbol: "TEST1", nameCn: "测试股票", market: "INVALID_MARKET" }),
  });
  const res4 = await createStock(req4);
  assert.equal(res4.status, 400);
  const data4 = await res4.json();
  assert.match(data4.error, /无效的市场代码/);
});

test("POST /api/stocks handles successful creation, duplicate conflict, and re-activation", async () => {
  // 1. Duplicate active stock -> 409 Conflict
  prisma.stock.findUnique = (async ({ where }: { where: { symbol?: string } }) => {
    if (where.symbol === "AAPL") {
      return {
        id: 1,
        symbol: "AAPL",
        name: "Apple Inc.",
        nameCn: "苹果",
        market: "US" as Market,
        price: null,
        changePct: null,
        updatedAt: null,
        createdAt: new Date(),
        isActive: true,
        isCustom: false,
      };
    }
    return null;
  }) as unknown as typeof prisma.stock.findUnique;

  const reqConflict = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({
      symbol: "AAPL",
      nameCn: "苹果公司",
      market: "US",
    }),
  });
  const resConflict = await createStock(reqConflict);
  assert.equal(resConflict.status, 409);
  const dataConflict = await resConflict.json();
  assert.match(dataConflict.error, /已存在于自选股池中/);

  // 2. Duplicate inactive stock -> re-activates and returns 200
  prisma.stock.findUnique = (async ({ where }: { where: { symbol?: string } }) => {
    if (where.symbol === "BABA") {
      return {
        id: 2,
        symbol: "BABA",
        name: "Alibaba",
        nameCn: "阿里巴巴",
        market: "US" as Market,
        price: null,
        changePct: null,
        updatedAt: null,
        createdAt: new Date(),
        isActive: false,
        isCustom: true,
      };
    }
    return null;
  }) as unknown as typeof prisma.stock.findUnique;

  prisma.stock.update = (async (args: { data: Partial<Stock> }) => {
    return {
      id: 2,
      symbol: "BABA",
      name: "Alibaba",
      nameCn: "阿里巴巴",
      market: "US" as Market,
      price: null,
      changePct: null,
      updatedAt: null,
      createdAt: new Date(),
      isCustom: true,
      isActive: true,
      ...args.data,
    };
  }) as unknown as typeof prisma.stock.update;

  const reqReactivate = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({
      symbol: "BABA",
      nameCn: "阿里巴巴集团",
      market: "US",
    }),
  });
  const resReactivate = await createStock(reqReactivate);
  assert.equal(resReactivate.status, 200);
  const dataReactivate = await resReactivate.json();
  assert.equal(dataReactivate.stock.isActive, true);
  assert.match(dataReactivate.message, /重新激活/);

  // 3. New unique stock -> 201 Created
  prisma.stock.findUnique = (async () => null) as unknown as typeof prisma.stock.findUnique;
  prisma.stock.create = (async (args: { data: Record<string, unknown> }) => {
    return {
      id: 3,
      price: null,
      changePct: null,
      updatedAt: null,
      createdAt: new Date(),
      ...args.data,
    };
  }) as unknown as typeof prisma.stock.create;

  const reqCreate = new NextRequest("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify({
      symbol: "600519.SS",
      nameCn: "贵州茅台",
      name: "Kweichow Moutai",
      market: "CN",
    }),
  });
  const resCreate = await createStock(reqCreate);
  assert.equal(resCreate.status, 201);
  const dataCreate = await resCreate.json();
  assert.equal(dataCreate.stock.symbol, "600519.SS");
  assert.equal(dataCreate.stock.market, "CN");
  assert.equal(dataCreate.stock.isActive, true);
  assert.equal(dataCreate.stock.isCustom, true);
});

test("GET /api/stocks queries active or all stocks with market filtering", async () => {
  const captured: { where?: { isActive?: boolean; market?: string } } = {};
  prisma.stock.findMany = (async (args: { where?: { isActive?: boolean; market?: string } }) => {
    captured.where = args?.where;
    return [
      { id: 1, symbol: "AAPL", market: "US" as Market, isActive: true },
      { id: 2, symbol: "600519.SS", market: "CN" as Market, isActive: true },
    ];
  }) as unknown as typeof prisma.stock.findMany;

  // 1. Default: only active
  const req1 = new NextRequest("http://localhost/api/stocks");
  const res1 = await getStocks(req1);
  assert.equal(res1.status, 200);
  assert.equal(captured.where?.isActive, true);
  assert.equal(captured.where?.market, undefined);

  // 2. all=true and market=CN
  const req2 = new NextRequest("http://localhost/api/stocks?all=true&market=CN");
  const res2 = await getStocks(req2);
  assert.equal(res2.status, 200);
  assert.equal(captured.where?.isActive, undefined);
  assert.equal(captured.where?.market, "CN");
});

test("PATCH and DELETE /api/stocks/[id] parameter, not-found and update validation", async () => {
  // Test invalid NaN id
  const reqPatchNaN = new NextRequest("http://localhost/api/stocks/invalid", {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
  const resPatchNaN = await patchStock(reqPatchNaN, { params: Promise.resolve({ id: "invalid" }) });
  assert.equal(resPatchNaN.status, 400);

  const reqDeleteNaN = new NextRequest("http://localhost/api/stocks/invalid", {
    method: "DELETE",
  });
  const resDeleteNaN = await deleteStock(reqDeleteNaN, { params: Promise.resolve({ id: "invalid" }) });
  assert.equal(resDeleteNaN.status, 400);

  // Test 404 when stock does not exist
  prisma.stock.findUnique = (async () => null) as unknown as typeof prisma.stock.findUnique;

  const reqNotFound = new NextRequest("http://localhost/api/stocks/99999", {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
  const resNotFound = await patchStock(reqNotFound, { params: Promise.resolve({ id: "99999" }) });
  assert.equal(resNotFound.status, 404);

  const reqDelNotFound = new NextRequest("http://localhost/api/stocks/99999", {
    method: "DELETE",
  });
  const resDelNotFound = await deleteStock(reqDelNotFound, { params: Promise.resolve({ id: "99999" }) });
  assert.equal(resDelNotFound.status, 404);

  // Test successful PATCH and DELETE
  prisma.stock.findUnique = (async ({ where }: { where: { id: number } }) => {
    return {
      id: where.id,
      symbol: "TEST",
      name: "Test",
      nameCn: "测试",
      market: "US" as Market,
      price: null,
      changePct: null,
      updatedAt: null,
      createdAt: new Date(),
      isActive: true,
      isCustom: true,
    };
  }) as unknown as typeof prisma.stock.findUnique;

  const capturedUpdate: { data?: Partial<Stock> } = {};
  prisma.stock.update = (async (args: { data: Partial<Stock> }) => {
    capturedUpdate.data = args.data;
    return {
      id: 10,
      symbol: "TEST",
      name: "Test",
      nameCn: "测试",
      market: "US" as Market,
      price: null,
      changePct: null,
      updatedAt: null,
      createdAt: new Date(),
      isActive: true,
      isCustom: true,
      ...args.data,
    };
  }) as unknown as typeof prisma.stock.update;

  const reqPatchSuccess = new NextRequest("http://localhost/api/stocks/10", {
    method: "PATCH",
    body: JSON.stringify({ isActive: false, nameCn: "更新中文名" }),
  });
  const resPatchSuccess = await patchStock(reqPatchSuccess, { params: Promise.resolve({ id: "10" }) });
  assert.equal(resPatchSuccess.status, 200);
  assert.equal(capturedUpdate.data?.isActive, false);
  assert.equal(capturedUpdate.data?.nameCn, "更新中文名");

  let deletedId: number | undefined = undefined;
  prisma.article.findMany = (async () => []) as unknown as typeof prisma.article.findMany;
  prisma.clusterArticle.findMany = (async () => []) as unknown as typeof prisma.clusterArticle.findMany;
  prisma.clusterArticle.deleteMany = (async () => ({ count: 0 })) as unknown as typeof prisma.clusterArticle.deleteMany;
  prisma.newsCluster.deleteMany = (async () => ({ count: 0 })) as unknown as typeof prisma.newsCluster.deleteMany;

  prisma.stock.delete = (async (args: { where: { id: number } }) => {
    deletedId = args.where.id;
    return {
      id: deletedId,
      symbol: "TEST",
      name: "Test",
      nameCn: "测试",
      market: "US" as Market,
      price: null,
      changePct: null,
      updatedAt: null,
      createdAt: new Date(),
      isActive: true,
      isCustom: true,
    };
  }) as unknown as typeof prisma.stock.delete;

  const reqDeleteSuccess = new NextRequest("http://localhost/api/stocks/10", {
    method: "DELETE",
  });
  const resDeleteSuccess = await deleteStock(reqDeleteSuccess, { params: Promise.resolve({ id: "10" }) });
  assert.equal(resDeleteSuccess.status, 200);
  assert.equal(deletedId, 10);
});
