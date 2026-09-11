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
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (confirm("确定要清空数据库中的所有历史新闻缓存吗？将彻底移除之前的旧数据并重新抓取。")) {
                await fetch("/api/news?all=true", { method: "DELETE" });
                handleStocksChanged();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors cursor-pointer"
            title="一键清空数据库里的所有旧新闻"
          >
            <span>🗑️</span>
            <span>清空旧新闻</span>
          </button>
          <button
            onClick={() => setIsManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-primary text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            <span>⚙️</span>
            <span>管理自选</span>
          </button>
        </div>
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
