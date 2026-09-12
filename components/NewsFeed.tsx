"use client";

import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { NewsCard } from "./NewsCard";
import { FilterBar, MarketFilter } from "./FilterBar";

interface NewsItem {
  id: number;
  title: string;
  aiSummary: string | null;
  keyPoints: string[] | null;
  verificationStatus: "verified" | "unverified";
  sourceCount: number;
  publishedAt: string;
  stock: { symbol: string; nameCn: string; market: string } | null;
  sources: { title: string; url: string; source: string; publishedAt: string }[];
}

export interface NewsFeedHandle {
  refresh: () => Promise<void>;
}

export const NewsFeed = forwardRef<NewsFeedHandle>((_props, ref) => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNews = useCallback(async (triggerFetch = false) => {
    try {
      if (triggerFetch) setRefreshing(true);
      setErrorMsg(null);

      if (triggerFetch) {
        // 主动触发一次增量抓取并等待执行完毕
        try {
          const fetchRes = await fetch("/api/v1/hermes/trigger-fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skipAi: false }),
          });
          const fetchResult = await fetchRes.json();
          if (!fetchRes.ok && fetchResult.message) {
            console.warn("Trigger fetch notice:", fetchResult.message);
          }
        } catch {
          // ignore
        }
      }

      const params = new URLSearchParams();
      if (market !== "ALL") params.set("market", market);
      if (verifiedOnly) params.set("verified", "true");
      params.set("limit", "50");

      const res = await fetch(`/api/news?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setItems(data.items || []);
      }
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [market, verifiedOnly]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchNews(false),
  }));

  useEffect(() => {
    fetchNews();
    const interval = setInterval(() => fetchNews(false), 300000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return (
    <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <FilterBar
            selected={market}
            onSelect={setMarket}
            verifiedOnly={verifiedOnly}
            onVerifiedToggle={setVerifiedOnly}
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchNews(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
              title="手动触发全量自选股新闻采集与聚合"
            >
              <span>{refreshing ? "⏳" : "🔄"}</span>
              <span>{refreshing ? "抓取中..." : "立即抓取"}</span>
            </button>
          </div>
        </div>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-secondary text-sm">
          加载中...
        </div>
      ) : errorMsg ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 my-6 text-center text-sm text-red-400">
          <p className="font-semibold mb-1">数据库或数据获取异常：</p>
          <p className="text-xs text-red-400/80 mb-3">{errorMsg}</p>
          <button
            onClick={() => fetchNews(true)}
            className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-background rounded text-xs font-medium cursor-pointer transition-colors"
          >
            重试抓取
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary text-sm">
          <p className="mb-3">暂无新闻数据（新初始化数据库尚无新闻聚簇）</p>
          <button
            onClick={() => fetchNews(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2"
          >
            {refreshing ? "正在抓取全网资讯中，请稍候..." : "⚡ 立即抓取最新资讯"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <NewsCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
});

NewsFeed.displayName = "NewsFeed";
