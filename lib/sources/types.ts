export type SourceType =
  | "finnhub"
  | "googlenews"
  | "yahoo"
  | "eastmoney"
  | "cls"
  | "sina"
  | "ths"
  | "research";

export interface RawArticle {
  title: string;
  snippet: string;
  url: string;
  source: SourceType;
  publishedAt: Date;
  stockId: number;
}

export interface FetchNewsParams {
  symbol: string;
  name: string;
  nameCn: string;
  market: "US" | "HK" | "CN" | "INDEX" | string;
  stockId: number;
}

export type NewsFetcher = (params: FetchNewsParams) => Promise<RawArticle[]>;

export interface SourceAdapter {
  id: SourceType;
  name: string;
  /**
   * Check if adapter supports the specific market
   */
  supportsMarket(market: string): boolean;
  fetch: NewsFetcher;
}
