import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateHermesRequest } from "@/lib/hermes/auth";
import { seedInitialStocks } from "@/lib/stocks-seed";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateHermesRequest(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    await seedInitialStocks();

    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol");
    const market = searchParams.get("market");
    const verified = searchParams.get("verified");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const cursor = searchParams.get("cursor");
    const days = parseInt(searchParams.get("days") || "3", 10);

    const where: Record<string, unknown> = {};

    if (verified === "true") {
      where.verificationStatus = "verified";
    }

    if (days > 0) {
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      where.publishedAt = { gte: sinceDate };
    }

    if (cursor) {
      where.id = { lt: parseInt(cursor, 10) };
    }

    if (symbol) {
      where.articles = {
        some: {
          article: {
            stock: { symbol: symbol.toUpperCase() },
          },
        },
      };
    }

    const clusters = await prisma.newsCluster.findMany({
      where,
      include: {
        articles: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                url: true,
                source: true,
                stockId: true,
                publishedAt: true,
              },
            },
          },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: limit + 1,
    });

    let filtered = clusters;
    if (market) {
      const stocks = await prisma.stock.findMany({
        where: { market: market.toUpperCase() as "US" | "HK" | "CN" | "INDEX" },
        select: { id: true },
      });
      const stockIds = new Set(stocks.map((s) => s.id));
      filtered = clusters.filter((c) => {
        const sid = c.articles[0]?.article.stockId;
        return sid !== undefined && stockIds.has(sid);
      });
    }

    const hasMore = filtered.length > limit;
    const items = filtered.slice(0, limit);

    const enrichedItems = await Promise.all(
      items.map(async (c) => {
        const stockId = c.articles[0]?.article.stockId;
        const stock = stockId
          ? await prisma.stock.findUnique({
              where: { id: stockId },
              select: {
                symbol: true,
                name: true,
                nameCn: true,
                market: true,
                price: true,
                changePct: true,
              },
            })
          : null;

        return {
          id: c.id,
          title: c.title,
          aiSummary: c.aiSummary,
          keyPoints: c.keyPoints || [],
          verificationStatus: c.verificationStatus,
          sourceCount: c.sourceCount,
          publishedAt: c.publishedAt.toISOString(),
          stock,
          sources: c.articles.map((ca) => ({
            name: ca.article.source,
            title: ca.article.title,
            url: ca.article.url,
            publishedAt: ca.article.publishedAt.toISOString(),
          })),
        };
      })
    );

    const totalActiveStocks = await prisma.stock.count({ where: { isActive: true } });

    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        items: enrichedItems,
        nextCursor: hasMore && items.length > 0 ? String(items[items.length - 1].id) : null,
        hasMore,
      },
      meta: {
        totalActiveStocks,
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
