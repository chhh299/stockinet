import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAndProcessNewsBatch } from "@/lib/pipeline/fetch-all";
import { seedInitialStocks } from "@/lib/stocks-seed";

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

    const latestCluster = await prisma.newsCluster.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    });

    const staleMs = STALE_MINUTES * 60 * 1000;
    const isStale = !latestCluster
      || (Date.now() - latestCluster.publishedAt.getTime() > staleMs);

    if (isStale) {
      const batch = Math.floor(Date.now() / 60000) % 8;
      // Run with AI relevance filter + summarization. 9s cap for Vercel 10s limit.
      await Promise.race([
        fetchAndProcessNewsBatch(batch, false),
        new Promise((r) => setTimeout(r, 9000)),
      ]);
    }

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
      const stocks = await prisma.stock.findMany({
        where: { market: market as "US" | "HK" | "CN" | "INDEX" },
        select: { id: true },
      });
      const stockIds = new Set(stocks.map((s) => s.id));
      filtered = clusters.filter((c) => {
        // 检查聚簇下任意一篇文章关联的股票 ID 是否属于当前市场
        return c.articles.some((ca) => ca.article?.stockId && stockIds.has(ca.article.stockId));
      });
    }

    const hasMore = filtered.length > limit;
    const items = filtered.slice(0, limit);

    const enriched = await Promise.all(
      items.map(async (c) => {
        const stockId = c.articles[0]?.article.stockId;
        const stock = stockId
          ? await prisma.stock.findUnique({ where: { id: stockId } })
          : null;

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
    );

    const response = NextResponse.json({
      items: enriched,
      nextCursor: hasMore ? String(items[items.length - 1]?.id) : null,
      refreshing: isStale,
    });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
