import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedInitialStocks } from "@/lib/stocks-seed";
import { fetchLiveQuotes } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await seedInitialStocks();

    const stocks = await prisma.stock.findMany({
      where: { isActive: true },
      orderBy: [{ market: "asc" }, { symbol: "asc" }],
      select: {
        symbol: true,
        name: true,
        nameCn: true,
        market: true,
        price: true,
        changePct: true,
        updatedAt: true,
      },
    });

    // 实时拉取最新行情 (覆盖 A 股、港股、美股)，彻底解决价格显示为 - 的问题
    const symbols = stocks.map((s) => s.symbol);
    const liveQuotes = await fetchLiveQuotes(symbols);

    const latestHeadlines = await Promise.all(
      stocks.map(async (s) => {
        const latestCluster = await prisma.newsCluster.findFirst({
          where: {
            articles: {
              some: { article: { stock: { symbol: s.symbol } } },
            },
          },
          orderBy: { publishedAt: "desc" },
          select: { title: true },
        });
        return { symbol: s.symbol, headline: latestCluster?.title || null };
      })
    );

    const headlinesMap = new Map(latestHeadlines.map((h) => [h.symbol, h.headline]));

    const response = NextResponse.json(
      stocks.map((s) => {
        const live = liveQuotes.get(s.symbol);
        return {
          ...s,
          price: live?.price ?? s.price,
          changePct: live?.changePct ?? s.changePct,
          latestHeadline: headlinesMap.get(s.symbol) || null,
        };
      })
    );
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
