import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateHermesRequest } from "@/lib/hermes/auth";
import { seedInitialStocks } from "@/lib/stocks-seed";

export const dynamic = "force-dynamic";

const VALID_MARKETS = ["US", "HK", "CN", "INDEX"] as const;
type MarketType = (typeof VALID_MARKETS)[number];

// GET /api/v1/hermes/stocks?activeOnly=true|false&market=US|HK|CN|INDEX
export async function GET(request: NextRequest) {
  const auth = authenticateHermesRequest(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    await seedInitialStocks();

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const market = searchParams.get("market");

    const where: Record<string, unknown> = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (market && VALID_MARKETS.includes(market.toUpperCase() as MarketType)) {
      where.market = market.toUpperCase();
    }

    const stocks = await prisma.stock.findMany({
      where,
      orderBy: [{ market: "asc" }, { symbol: "asc" }],
      select: {
        id: true,
        symbol: true,
        name: true,
        nameCn: true,
        market: true,
        price: true,
        changePct: true,
        isActive: true,
        isCustom: true,
        updatedAt: true,
      },
    });

    const latestHeadlines = await Promise.all(
      stocks.map(async (s) => {
        const latestCluster = await prisma.newsCluster.findFirst({
          where: {
            articles: {
              some: { article: { stock: { symbol: s.symbol } } },
            },
          },
          orderBy: { publishedAt: "desc" },
          select: {
            title: true,
            aiSummary: true,
            publishedAt: true,
          },
        });
        return {
          symbol: s.symbol,
          headline: latestCluster?.title || null,
          latestAiSummary: latestCluster?.aiSummary || null,
          newsPublishedAt: latestCluster?.publishedAt ? latestCluster.publishedAt.toISOString() : null,
        };
      })
    );

    const headlineMap = new Map(latestHeadlines.map((h) => [h.symbol, h]));

    const enrichedStocks = stocks.map((s) => {
      const newsInfo = headlineMap.get(s.symbol);
      return {
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        nameCn: s.nameCn,
        market: s.market,
        price: s.price,
        changePct: s.changePct,
        isActive: s.isActive,
        isCustom: s.isCustom,
        updatedAt: s.updatedAt ? s.updatedAt.toISOString() : null,
        latestHeadline: newsInfo?.headline || null,
        latestAiSummary: newsInfo?.latestAiSummary || null,
        latestNewsAt: newsInfo?.newsPublishedAt || null,
      };
    });

    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        stocks: enrichedStocks,
        total: enrichedStocks.length,
      },
      meta: {
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { code: 500, message: `Server error: ${String(error)}`, data: null },
      { status: 500 }
    );
  }
}

// POST /api/v1/hermes/stocks
// Body: { symbol, name, nameCn, market }
export async function POST(request: NextRequest) {
  const auth = authenticateHermesRequest(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    await seedInitialStocks();

    const body = await request.json();
    const { symbol: rawSymbol, name: rawName, nameCn: rawNameCn, market } = body || {};
    let symbol = rawSymbol;
    let nameCn = rawNameCn;
    let name = rawName;

    if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
      return NextResponse.json(
        { code: 400, message: "Missing or invalid parameter: symbol is required", data: null },
        { status: 400 }
      );
    }
    symbol = symbol.trim().toUpperCase();

    if (!nameCn || typeof nameCn !== "string" || !nameCn.trim()) {
      return NextResponse.json(
        { code: 400, message: "Missing or invalid parameter: nameCn is required", data: null },
        { status: 400 }
      );
    }
    nameCn = nameCn.trim();

    if (!name || typeof name !== "string" || !name.trim()) {
      name = nameCn;
    } else {
      name = name.trim();
    }

    if (!market || typeof market !== "string") {
      return NextResponse.json(
        { code: 400, message: "Missing or invalid parameter: market is required", data: null },
        { status: 400 }
      );
    }

    const upperMarket = market.trim().toUpperCase();
    if (!VALID_MARKETS.includes(upperMarket as MarketType)) {
      return NextResponse.json(
        {
          code: 400,
          message: `Invalid market: ${market}. Valid options: ${VALID_MARKETS.join(", ")}`,
          data: null,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.stock.findUnique({ where: { symbol } });
    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.stock.update({
          where: { symbol },
          data: {
            isActive: true,
            name,
            nameCn,
            market: upperMarket as MarketType,
          },
        });
        return NextResponse.json({
          code: 0,
          message: "Stock already exists in inactive state, reactivated successfully",
          data: updated,
        });
      }
      return NextResponse.json(
        { code: 409, message: `Stock ${symbol} already exists`, data: null },
        { status: 409 }
      );
    }

    const created = await prisma.stock.create({
      data: {
        symbol,
        name,
        nameCn,
        market: upperMarket as MarketType,
        isActive: true,
        isCustom: true,
      },
    });

    return NextResponse.json(
      {
        code: 0,
        message: "Stock added successfully",
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { code: 500, message: `Server error: ${String(error)}`, data: null },
      { status: 500 }
    );
  }
}
