import { prisma } from "./db";

/**
 * 将美股/港股/A股统一转换为腾讯行情支持的证券代码
 * 例如:
 * 000923.SZ -> sz000923
 * 600519.SS -> sh600519
 * 0700.HK   -> r_hk00700
 * AAPL      -> usAAPL
 */
function toTencentSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (upper.endsWith(".SZ")) {
    return `sz${upper.replace(".SZ", "")}`;
  }
  if (upper.endsWith(".SS")) {
    return `sh${upper.replace(".SS", "")}`;
  }
  if (upper.endsWith(".HK")) {
    const num = upper.replace(".HK", "").padStart(5, "0");
    return `r_hk${num}`;
  }
  if (upper.startsWith("^")) {
    if (upper === "^HSI") return "r_hkHSI";
    if (upper === "^GSPC") return "us.INX";
    if (upper === "^IXIC") return "us.IXIC";
    if (upper === "^DJI") return "us.DJI";
    return "";
  }
  // 美股个股 (如 AAPL, NVDA, TSLA)
  return `us${upper}`;
}

/**
 * 批量调用腾讯财经行情接口 (借鉴 a-share-research-monitor)
 * 免鉴权、低延迟、全市场支持 (A股/港股/美股/指数)
 */
export async function fetchLiveQuotes(
  symbols: string[]
): Promise<Map<string, { price: number; changePct: number }>> {
  const quoteMap = new Map<string, { price: number; changePct: number }>();
  if (symbols.length === 0) return quoteMap;

  try {
    const tencentCodes: string[] = [];
    const codeToSymbol = new Map<string, string>();

    for (const sym of symbols) {
      const tc = toTencentSymbol(sym);
      if (tc) {
        tencentCodes.push(tc);
        codeToSymbol.set(tc.toLowerCase(), sym);
      }
    }

    if (tencentCodes.length === 0) return quoteMap;

    const url = `https://qt.gtimg.cn/q=${tencentCodes.join(",")}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return quoteMap;

    const text = await res.text();
    // 解析类似: v_sz000923="51~河钢资源~000923~17.00~18.35~17.34~...~-7.36~...";
    const lines = text.split(";");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/v_([a-z0-9_]+)="([^"]+)"/i);
      if (match) {
        const tCode = match[1].toLowerCase();
        const originalSymbol = codeToSymbol.get(tCode);
        if (!originalSymbol) continue;

        const parts = match[2].split("~");
        if (parts.length >= 33) {
          // 当前价通常在下标 3
          const currentPrice = parseFloat(parts[3]);
          // 涨跌幅通常在下标 32 (如 -7.36 或 0.95)
          const changePercent = parseFloat(parts[32]);

          if (!isNaN(currentPrice) && currentPrice > 0) {
            quoteMap.set(originalSymbol, {
              price: currentPrice,
              changePct: isNaN(changePercent) ? 0 : changePercent,
            });
          }
        }
      }
    }
  } catch {
    // 忽略异常并降级
  }

  return quoteMap;
}

/**
 * 刷新数据库所有活跃自选股行情数据
 */
export async function refreshMarketData(): Promise<void> {
  const stocks = await prisma.stock.findMany({
    where: { isActive: true },
    select: { symbol: true },
  });

  const symbols = stocks.map((s) => s.symbol);
  const quotes = await fetchLiveQuotes(symbols);

  for (const [symbol, q] of quotes.entries()) {
    await prisma.stock.updateMany({
      where: { symbol },
      data: {
        price: q.price,
        changePct: q.changePct,
        updatedAt: new Date(),
      },
    });
  }
}
