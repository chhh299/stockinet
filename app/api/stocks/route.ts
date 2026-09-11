import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedInitialStocks } from "@/lib/stocks-seed";

const VALID_MARKETS = ["US", "HK", "CN", "INDEX"] as const;
type MarketType = (typeof VALID_MARKETS)[number];

// GET /api/stocks?all=true|false&market=US|HK|CN|INDEX
export async function GET(request: NextRequest) {
  try {
    // Seed default stocks if table is completely empty
    await seedInitialStocks();

    const searchParams = request.nextUrl.searchParams;
    const all = searchParams.get("all") === "true";
    const market = searchParams.get("market");

    const where: Record<string, unknown> = {};
    if (!all) {
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
        createdAt: true,
      },
    });

    return NextResponse.json({ stocks });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/stocks
// Body: { symbol, name, nameCn, market }
export async function POST(request: NextRequest) {
  try {
    await seedInitialStocks();

    const body = await request.json();
    const { symbol: rawSymbol, name: rawName, nameCn: rawNameCn, market } = body || {};
    let symbol = rawSymbol;
    let nameCn = rawNameCn;
    let name = rawName;

    if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
      return NextResponse.json(
        { error: "股票代码 (symbol) 不能为空" },
        { status: 400 }
      );
    }

    symbol = symbol.trim().toUpperCase();

    if (!nameCn || typeof nameCn !== "string" || !nameCn.trim()) {
      return NextResponse.json(
        { error: "中文简称 (nameCn) 不能为空" },
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
        { error: "交易市场 (market) 必须为 US / HK / CN / INDEX 之一" },
        { status: 400 }
      );
    }

    const upperMarket = market.trim().toUpperCase();
    if (!VALID_MARKETS.includes(upperMarket as MarketType)) {
      return NextResponse.json(
        { error: `无效的市场代码: ${market}。允许的值: ${VALID_MARKETS.join(", ")}` },
        { status: 400 }
      );
    }

    // Check conflict
    const existing = await prisma.stock.findUnique({
      where: { symbol },
    });

    if (existing) {
      if (!existing.isActive) {
        // Re-activate if it was inactive
        const updated = await prisma.stock.update({
          where: { symbol },
          data: {
            isActive: true,
            name,
            nameCn,
            market: upperMarket as MarketType,
          },
        });
        return NextResponse.json(
          { stock: updated, message: "标的已存在且处于停用状态，已重新激活" },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: `标的代码 ${symbol} 已存在于自选股池中` },
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

    return NextResponse.json({ stock: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE /api/stocks (批量删除/全部清空)
export async function DELETE(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get("all") === "true";
    if (all) {
      const deleted = await prisma.stock.deleteMany({});
      return NextResponse.json({ success: true, count: deleted.count });
    }
    return NextResponse.json({ error: "Missing parameter 'all=true'" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
