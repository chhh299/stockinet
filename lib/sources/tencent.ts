import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface TencentNoticeItem {
  id: string;
  symbol: string;
  title: string;
  time: string;
  url?: string;
}

/**
 * 将股票代码转换为腾讯接口所需的统一格式
 * 如 600726.SS -> sh600726, 000923.SZ -> sz000923, 0700.HK -> hk00700
 */
function toTencentStockCode(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (upper.endsWith(".SS")) {
    return `sh${upper.replace(".SS", "")}`;
  }
  if (upper.endsWith(".SZ")) {
    return `sz${upper.replace(".SZ", "")}`;
  }
  if (upper.endsWith(".HK")) {
    const num = upper.replace(".HK", "").padStart(5, "0");
    return `hk${num}`;
  }
  return "";
}

/**
 * 腾讯财经 / 腾讯自选股官方公告资讯适配器
 * 直接根据个股代码拉取权威官方披露、股东会及公司大事件
 */
export async function fetchTencentNews({
  symbol,
  nameCn,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    const tencentCode = toTencentStockCode(symbol);
    if (!tencentCode) return articles;

    const url = `https://proxy.finance.qq.com/ifzqgtimg/appstock/news/noticeList/search?symbol=${tencentCode}&page=1&n=15`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://gu.qq.com/",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json = await res.json();
      const list: TencentNoticeItem[] = json?.data?.data || [];

      for (const item of list) {
        if (!item.title || !item.id) continue;

        // 拼接腾讯财经官方公告正文或快讯地址
        const noticeUrl =
          item.url && item.url.startsWith("http")
            ? item.url
            : `https://stock.finance.qq.com/notice/view.php?id=${item.id}`;

        const pubDate = item.time ? new Date(item.time.replace(/-/g, "/")) : new Date();

        articles.push({
          title: item.title.trim(),
          snippet: `【腾讯财经】${nameCn} 官方公告资讯：${item.title.trim()}`,
          url: noticeUrl,
          source: "tencent",
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          stockId,
        });
      }
    }
  } catch {
    // 忽略异常并优雅降级
  }

  return articles;
}

export const TencentAdapter: SourceAdapter = {
  id: "tencent",
  name: "腾讯财经",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK";
  },
  fetch: fetchTencentNews,
};
