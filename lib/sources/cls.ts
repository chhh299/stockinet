import { RawArticle, FetchNewsParams, SourceAdapter } from "./types";

interface ClsTelegraphItem {
  id: number | string;
  title?: string;
  content: string;
  ctime: number;
}

export async function fetchClsNews({
  nameCn,
  symbol,
  stockId,
}: FetchNewsParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    // Attempt to scrape latest telegraphs from CLS telegraph page
    const res = await fetch("https://www.cls.cn/telegraph", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const html = await res.text();
      // Extract telegraph items from script or HTML structure
      const startTag = '<script id="__NEXT_DATA__" type="application/json">';
      const start = html.indexOf(startTag);
      if (start !== -1) {
        const end = html.indexOf("</script>", start);
        if (end !== -1) {
          const jsonStr = html.slice(start + startTag.length, end);
          const data = JSON.parse(jsonStr);
          const state = data?.props?.pageProps?.initialState;
          const telegraphs: ClsTelegraphItem[] =
            state?.telegraph?.telegraphList || data?.props?.pageProps?.rollData || [];

          const cleanCode = symbol.replace(/\.(SS|SZ|HK)/i, "");

          for (const item of telegraphs) {
            const text = `${item.title || ""} ${item.content || ""}`;
            if (text.includes(nameCn) || (cleanCode.length >= 4 && text.includes(cleanCode))) {
              articles.push({
                title: item.title || item.content.slice(0, 60),
                snippet: item.content,
                url: `https://www.cls.cn/detail/${item.id}`,
                source: "cls",
                publishedAt: item.ctime ? new Date(item.ctime * 1000) : new Date(),
                stockId,
              });
            }
          }
        }
      }
    }
  } catch {
    // Fallback gracefully on anti-scraping or network error
  }

  return articles;
}

export const ClsAdapter: SourceAdapter = {
  id: "cls",
  name: "财联社",
  supportsMarket(market: string): boolean {
    return market === "CN" || market === "HK" || market === "INDEX";
  },
  fetch: fetchClsNews,
};
