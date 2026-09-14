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

    // 快速读取所有活跃股票建立 ID 映射表，消灭循环查数据库的 N+1 性能黑洞
    const allStocks = await prisma.stock.findMany({
      select: { id: true, symbol: true, nameCn: true, market: true },
    });
    const stockMap = new Map(allStocks.map((s) => [s.id, s]));

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
