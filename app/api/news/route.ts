import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAndProcessNewsBatch } from "@/lib/pipeline/fetch-all";
import { seedInitialStocks } from "@/lib/stocks-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STALE_MINUTES = 65;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const market = searchParams.get("market");
  const symbol = searchParams.get("symbol");
  const verifiedOnly = searchParams.get("verified") === "true";
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  try {
    await seedInitialStocks();

    // 快速读取所有当前处于活跃监控状态的股票
    const allActiveStocks = await prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, symbol: true, nameCn: true, market: true },
    });
    const activeStockIds = new Set(allActiveStocks.map((s) => s.id));
    const stockMap = new Map(allActiveStocks.map((s) => [s.id, s]));

    const where: Record<string, unknown> = {};

    if (verifiedOnly) {
      where.verificationStatus = "verified";
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
    } else {
      // 核心约束：新闻必须属于当前仍然存在且处于激活状态的自选股，已被删除的自选股新闻立刻隐藏
      where.articles = {
        some: {
          article: {
            stockId: { in: Array.from(activeStockIds) },
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
    if (market && market !== "ALL") {
      filtered = clusters.filter((c) => {
        return c.articles.some((ca) => {
          const s = stockMap.get(ca.article.stockId);
          return s && s.market === market;
        });
      });
    }

    const hasMore = filtered.length > limit;
    const items = filtered.slice(0, limit);

    const enriched = items
      .map((c) => {
        const stockId = c.articles[0]?.article.stockId;
        const stock = stockId ? stockMap.get(stockId) : null;

        // 核心防御：如果该股票是 A 股或港股，但来源是 Yahoo，直接当作历史脏数据丢弃过滤
        if (stock && (stock.market === "CN" || stock.market === "HK")) {
          const hasYahooOnly = c.articles.every((ca) => ca.article.source === "yahoo");
          if (hasYahooOnly) {
            return null;
          }
        }

        return {
          id: c.id,
          title: c.title,
          aiSummary: c.aiSummary,
          keyPoints: c.keyPoints,
          verificationStatus: c.verificationStatus,
          sourceCount: c.sourceCount,
          publishedAt: c.publishedAt,
          createdAt: c.createdAt,
          stock: stock
            ? { symbol: stock.symbol, nameCn: stock.nameCn, market: stock.market }
            : null,
          sources: c.articles.map((ca) => ({
            title: ca.article.title,
            url: ca.article.url,
            source: ca.article.source,
            publishedAt: ca.article.publishedAt,
          })),
        };
      })
      .filter(Boolean);

    const response = NextResponse.json({
      items: enriched,
      nextCursor: hasMore ? String(items[items.length - 1]?.id) : null,
      refreshing: false,
    });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE /api/news?all=true (一键清理所有历史新闻缓存与聚簇)
export async function DELETE(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get("all") === "true";
    if (all) {
      await prisma.clusterArticle.deleteMany({});
      await prisma.newsCluster.deleteMany({});
      await prisma.article.deleteMany({});
      return NextResponse.json({ success: true, message: "所有历史新闻已彻底清空" });
    }
    return NextResponse.json({ error: "Missing parameter 'all=true'" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
