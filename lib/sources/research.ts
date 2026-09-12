import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface EastMoneyReportItem {
  title: string;
  stockName: string;
  stockCode: string;
  orgSName: string;
  publishDate: string;
  infoCode: string;
  predictThisYearPe?: string;
  predictNextYearPe?: string;
  rating?: string;
}

/**
 * 东方财富个股研报适配器 (借鉴 a-share-research-monitor 的 stock_research_report_em)
 * 抓取券商卖方对个股的最新研究报告、评级与盈利预测
 */
export async function fetchResearchReports({
  symbol,
  nameCn,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    const cleanCode = symbol.replace(/\.(SS|SZ|HK)/i, "");
    const now = new Date();
    const beginTime = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endTime = now.toISOString().slice(0, 10);

    const url = `https://reportapi.eastmoney.com/report/list?cb=callback&industryCode=*&pageSize=10&industry=*&rating=*&ratingChange=*&beginTime=${beginTime}&endTime=${endTime}&fields=&pageNo=1&code=${cleanCode}&qType=0`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://data.eastmoney.com/report/stock.jshtml",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const text = await res.text();
      const match = text.match(/callback\(([\s\S]*)\);?/);
      if (match && match[1]) {
        const data = JSON.parse(match[1]) as { data?: EastMoneyReportItem[] };
        const list = data?.data || [];

        for (const item of list) {
          if (!item.title || !item.infoCode) continue;

          const org = item.orgSName || "卖方研报";
          const peText = item.predictThisYearPe ? `，预测PE: ${item.predictThisYearPe}倍` : "";
          const snippet = `【${org}】${nameCn} 研报点评：${item.title}${peText}。`;

          articles.push({
            title: `[研报] ${item.title} (${org})`,
            snippet,
            url: `https://data.eastmoney.com/report/zw_stock.jshtml?encodeUrl=${item.infoCode}`,
            source: "research",
            publishedAt: item.publishDate ? new Date(item.publishDate.replace(/-/g, "/")) : new Date(),
            stockId,
          });
        }
      }
    }
  } catch {
    // 忽略异常并降级
  }

  return articles;
}

export const ResearchAdapter: SourceAdapter = {
  id: "research",
  name: "券商研报",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK";
  },
  fetch: fetchResearchReports,
};
