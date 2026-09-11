import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface EastMoneyFastNewsItem {
  code: string;
  title: string;
  summary: string;
  showTime: string;
}

interface EastMoneyNoticeItem {
  art_code: string;
  title_ch: string;
  notice_date: string;
}

export async function fetchEastMoneyNews({
  symbol,
  nameCn,
  market,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  // 1. Fetch Company Announcements / Notices if CN or HK individual stock
  try {
    const cleanCode = symbol.replace(/\.(SS|SZ|HK)/i, "");
    const annType = market === "HK" ? "H" : "A";
    const paddedCode = market === "HK" ? cleanCode.padStart(5, "0") : cleanCode;

    const noticeUrl = `https://np-anotice-stock.eastmoney.com/api/security/ann?page_size=10&page_index=1&ann_type=${annType}&client_source=web&stock_list=${paddedCode}`;
    const res = await fetch(noticeUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = (await res.json()) as { data?: { list?: EastMoneyNoticeItem[] } };
      const list = data?.data?.list || [];
      for (const item of list) {
        if (!item.art_code || !item.title_ch) continue;
        articles.push({
          title: item.title_ch,
          snippet: `${nameCn} 官方公告: ${item.title_ch}`,
          url: `https://data.eastmoney.com/notices/detail/${paddedCode}/${item.art_code}.html`,
          source: "eastmoney",
          publishedAt: item.notice_date ? new Date(item.notice_date) : new Date(),
          stockId,
        });
      }
    }
  } catch {
    // Ignore and proceed to 7x24 fast news
  }

  // 2. Fetch 7x24 Fast News matching company name or symbol
  try {
    const fastNewsUrl = `https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=50&req_trace=${Date.now()}`;
    const res = await fetch(fastNewsUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = (await res.json()) as { data?: { fastNewsList?: EastMoneyFastNewsItem[] } };
      const list = data?.data?.fastNewsList || [];
      const cleanCode = symbol.replace(/\.(SS|SZ|HK)/i, "");

      for (const item of list) {
        const text = `${item.title || ""} ${item.summary || ""}`;
        if (text.includes(nameCn) || (cleanCode.length >= 4 && text.includes(cleanCode))) {
          articles.push({
            title: item.title || item.summary.slice(0, 50),
            snippet: item.summary,
            url: `https://finance.eastmoney.com/a/${item.code}.html`,
            source: "eastmoney",
            publishedAt: item.showTime ? new Date(item.showTime.replace(/-/g, "/")) : new Date(),
            stockId,
          });
        }
      }
    }
  } catch {
    // Fallback gracefully
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

export const EastMoneyAdapter: SourceAdapter = {
  id: "eastmoney",
  name: "东方财富",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK" || market === "INDEX";
  },
  fetch: fetchEastMoneyNews,
};
