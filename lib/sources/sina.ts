import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface SinaRollItem {
  title: string;
  url: string;
  intro?: string;
  ctime: string | number;
}

export async function fetchSinaNews({
  nameCn,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=${encodeURIComponent(nameCn)}&num=15`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        result?: { data?: SinaRollItem[] };
      };
      const list = data?.result?.data || [];

      for (const item of list) {
        if (!item.title || !item.url) continue;
        // Check if the article title or intro actually mentions the stock or company
        const text = `${item.title} ${item.intro || ""}`;
        if (!text.includes(nameCn)) {
          continue;
        }

        const timestamp = typeof item.ctime === "string" ? parseInt(item.ctime, 10) * 1000 : item.ctime * 1000;
        articles.push({
          title: item.title,
          snippet: item.intro || item.title,
          url: item.url,
          source: "sina",
          publishedAt: new Date(timestamp || Date.now()),
          stockId,
        });
      }
    }
  } catch {
    // Graceful error handling
  }

  return articles;
}

export const SinaAdapter: SourceAdapter = {
  id: "sina",
  name: "新浪财经",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK" || market === "INDEX";
  },
  fetch: fetchSinaNews,
};
