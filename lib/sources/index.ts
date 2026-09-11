import { SourceAdapter } from "./types";
import { fetchFinnhubNews } from "./finnhub";
import { fetchGoogleNews } from "./googlenews";
import { fetchYahooNews } from "./yahoo";
import { EastMoneyAdapter } from "./eastmoney";
import { ClsAdapter } from "./cls";
import { SinaAdapter } from "./sina";

export const FinnhubAdapter: SourceAdapter = {
  id: "finnhub",
  name: "Finnhub",
  supportsMarket(market: string): boolean {
    return market === "US";
  },
  fetch: fetchFinnhubNews,
};

export const GoogleNewsAdapter: SourceAdapter = {
  id: "googlenews",
  name: "Google News",
  supportsMarket(): boolean {
    return true; // Supports all markets
  },
  fetch: fetchGoogleNews,
};

export const YahooAdapter: SourceAdapter = {
  id: "yahoo",
  name: "Yahoo Finance",
  supportsMarket(market: string): boolean {
    return market === "US" || market === "INDEX"; // Yahoo 只服务于美股或海外指数，绝不用于 A 股 / 港股
  },
  fetch: fetchYahooNews,
};

export const ALL_ADAPTERS: SourceAdapter[] = [
  GoogleNewsAdapter,
  YahooAdapter,
  FinnhubAdapter,
  EastMoneyAdapter,
  ClsAdapter,
  SinaAdapter,
];

export function getActiveAdapters(
  market?: string,
  envSources = process.env.ENABLED_NEWS_SOURCES
): SourceAdapter[] {
  let enabledSet: Set<string> | null = null;
  if (envSources && envSources.trim().length > 0) {
    const list = envSources
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (list.length > 0) {
      enabledSet = new Set(list);
    }
  }

  return ALL_ADAPTERS.filter((adapter) => {
    // 1. Check if source is enabled via env var
    if (enabledSet && !enabledSet.has(adapter.id)) {
      return false;
    }
    // 2. Check if adapter supports current market
    if (market && !adapter.supportsMarket(market)) {
      return false;
    }
    return true;
  });
}

export * from "./types";
export { EastMoneyAdapter } from "./eastmoney";
export { ClsAdapter } from "./cls";
export { SinaAdapter } from "./sina";
