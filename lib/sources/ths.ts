import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface ThsStreamItem {
  id: string;
  title: string;
  digest: string;
  ctime: string | number;
  url?: string;
}

/**
 * 同花顺个股资讯适配器
 * 1. 深度抓取同花顺个股专属资讯中心 (涵盖公司动态、董秘回应、深度评析、临时股东会等)
 * 2. 补充同花顺 7x24 毫秒级直播流
 */
export async function fetchThsNews({
  symbol,
  nameCn,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];
  const cleanCode = symbol.replace(/\.(SS|SZ|HK)/i, "");

  // 1. 同花顺个股专属资讯接口 (按代码精准抓取 30+ 条公司深度动态与研报)
  try {
    const stockPageUrl = `https://stockpage.10jqka.com.cn/ajax/code/${cleanCode}/type/news/`;
    const res = await fetch(stockPageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: `https://stockpage.10jqka.com.cn/${cleanCode}/`,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      // 同花顺接口采用 GBK 编码返回，使用 TextDecoder('gbk') 准确还原为中文字符串
      const htmlText = new TextDecoder("gbk").decode(arrayBuffer);

      // 解析: <a ... href="http://news.10jqka.com.cn/..." ... title="...">
      const regex = /<a[^>]+href=\"(https?:\/\/news\.10jqka\.com\.cn\/[^\"]+)\"[^>]*title=\"([^\"]+)\"/g;
      let m: RegExpExecArray | null;

      while ((m = regex.exec(htmlText)) !== null) {
        const url = m[1].replace(/^http:/, "https:");
        const title = m[2].trim();

        // 尝试从 URL 提取日期 (如 /20260908/679703835.shtml)
        let pubDate = new Date();
        const dateMatch = url.match(/\/(\d{4})(\d{2})(\d{2})\//);
        if (dateMatch) {
          pubDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} 10:00:00`);
        }

        articles.push({
          title,
          snippet: `【同花顺个股】${nameCn} 最新动态：${title}`,
          url,
          source: "ths",
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          stockId,
        });
      }
    }
  } catch {
    // 忽略异常并尝试直播流
  }

  // 2. 同花顺 7x24 实时盘中快讯补充
  try {
    const streamUrl = "https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&tag=&track=website&pagesize=100";
    const res = await fetch(streamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://news.10jqka.com.cn/realtimenews.html",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        data?: { list?: ThsStreamItem[] };
      };
      const list = data?.data?.list || [];

      for (const item of list) {
        const text = `${item.title || ""} ${item.digest || ""}`;
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

  // 按 URL 去重
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

export const ThsAdapter: SourceAdapter = {
  id: "ths",
  name: "同花顺个股",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK" || market === "INDEX";
  },
  fetch: fetchThsNews,
};
