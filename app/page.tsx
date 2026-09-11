"use client";

import { useState, useRef } from "react";
import { TickerStrip, TickerStripHandle } from "@/components/TickerStrip";
import { NewsFeed, NewsFeedHandle } from "@/components/NewsFeed";
import { MarketOverview, MarketOverviewHandle } from "@/components/MarketOverview";
import { StockManagerModal } from "@/components/StockManagerModal";

type Tab = "news" | "overview";

export default function Home() {
  const [tab, setTab] = useState<Tab>("news");
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const tickerRef = useRef<TickerStripHandle>(null);
  const newsFeedRef = useRef<NewsFeedHandle>(null);
  const marketOverviewRef = useRef<MarketOverviewHandle>(null);

  const handleStocksChanged = () => {
    tickerRef.current?.refresh();
    newsFeedRef.current?.refresh();
    marketOverviewRef.current?.refresh();
  };

  return (
    <div className="max-w-3xl mx-auto min-h-screen">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            全球股市热点追踪
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            AI 驱动的全球股市新闻聚合 — 追踪美股、港股、A股热点
          </p>
        </div>
        <button
          onClick={() => setIsManagerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-primary text-xs font-medium transition-colors shadow-xs"
        >
          <span>⚙️</span>
          <span>管理自选</span>
        </button>
      </header>

      <TickerStrip ref={tickerRef} />

      <div className="px-4 py-3">
        <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border w-fit mb-4">
          <button
            onClick={() => setTab("news")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "news"
                ? "bg-accent/20 text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            全部新闻
          </button>
          <button
            onClick={() => setTab("overview")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "overview"
                ? "bg-accent/20 text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            自选概览
          </button>
        </div>

        {tab === "news" ? (
          <NewsFeed ref={newsFeedRef} />
        ) : (
          <MarketOverview ref={marketOverviewRef} />
        )}
      </div>

      <footer className="text-center text-xs text-text-secondary py-8">
        数据来源：Finnhub / Google News / Yahoo Finance / 东方财富 / 财联社 / 新浪财经 · 支持通用 OpenAI 兼容 LLM
      </footer>

      <StockManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onChanged={handleStocksChanged}
      />
    </div>
  );
}
