import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface ThsStreamItem {
  id: string;
  title: string;
  digest: string;
  ctime: string | number;
  url?: string;
}

/**
 * 同花顺财经直播适配器 (借鉴 a-share-research-monitor 的 stock_info_global_ths)
 * 具备极高的盘中异动与上市公司实时事件敏感度
 */
export async function fetchThsNews({
  symbol,
  nameCn,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    const cleanCode = symbol.replace(/\.(SS|SZ|HK)/i, "");
    // 同花顺实时股票直播快讯接口
    const url = "https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&tag=&track=website&pagesize=100";
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://news.10jqka.com.cn/realtimenews.html",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        data?: { list?: ThsStreamItem[] };
      };
      const list = data?.data?.list || [];

      for (const item of list) {
        const text = `${item.title || ""} ${item.digest || ""}`;
        // 必须精确匹配股票名称或 4 位以上纯代码
        if (text.includes(nameCn) || (cleanCode.length >= 4 && text.includes(cleanCode))) {
          const timestamp =
            typeof item.ctime === "string" ? parseInt(item.ctime, 10) * 1000 : Number(item.ctime) * 1000;

          articles.push({
            title: item.title || item.digest.slice(0, 60),
            snippet: item.digest || item.title,
            url: item.url || `https://news.10jqka.com.cn/m679848758/${item.id}.shtml`,
            source: "ths",
            publishedAt: new Date(timestamp || Date.now()),
            stockId,
          });
        }
      }
    }
  } catch {
    // 优雅降级
  }

  return articles;
}

export const ThsAdapter: SourceAdapter = {
  id: "ths",
  name: "同花顺直播",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK" || market === "INDEX";
  },
  fetch: fetchThsNews,
};
