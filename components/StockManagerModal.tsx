"use client";

import { useEffect, useState, useCallback } from "react";

export interface StockItem {
  id: number;
  symbol: string;
  name: string;
  nameCn: string;
  market: "US" | "HK" | "CN" | "INDEX";
  price: number | null;
  changePct: number | null;
  isActive: boolean;
  isCustom: boolean;
}

interface StockManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function StockManagerModal({
  isOpen,
  onClose,
  onChanged,
}: StockManagerModalProps) {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [symbol, setSymbol] = useState("");
  const [nameCn, setNameCn] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState<"US" | "HK" | "CN" | "INDEX">("CN");
  const [submitting, setSubmitting] = useState(false);

  // Search autocomplete states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; nameCn: string; name: string; market: "US" | "HK" | "CN" | "INDEX" }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectSearchResult = (item: { symbol: string; nameCn: string; name: string; market: "US" | "HK" | "CN" | "INDEX" }) => {
    setSymbol(item.symbol);
    setNameCn(item.nameCn);
    setName(item.name);
    setMarket(item.market);
    setSearchResults([]);
    setSearchQuery("");
  };

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks?all=true");
      const data = await res.json();
      if (res.ok && data.stocks) {
        setStocks(data.stocks);
      } else {
        setError(data.error || "获取自选股列表失败");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function fetchList() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stocks?all=true");
        const data = await res.json();
        if (!ignore) {
          if (res.ok && data.stocks) {
            setStocks(data.stocks);
          } else {
            setError(data.error || "获取自选股列表失败");
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(String(err));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchList();
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim() || !nameCn.trim()) {
      alert("请填写股票代码和中文简称");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim(),
          nameCn: nameCn.trim(),
          name: name.trim() || nameCn.trim(),
          market,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "添加失败");
      } else {
        setSymbol("");
        setNameCn("");
        setName("");
        await loadStocks();
        onChanged();
      }
    } catch (err) {
      alert(`添加错误: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(id: number, currentActive: boolean) {
    try {
      const res = await fetch(`/api/stocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        setStocks((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: !currentActive } : s))
        );
        onChanged();
      } else {
        const data = await res.json();
        alert(data.error || "状态更新失败");
      }
    } catch (err) {
      alert(`更新错误: ${String(err)}`);
    }
  }

  async function handleDeleteStock(id: number, stockSymbol: string) {
    if (!confirm(`确定要移除自选标的 ${stockSymbol} 吗？`)) {
      return;
    }

    try {
      const res = await fetch(`/api/stocks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStocks((prev) => prev.filter((s) => s.id !== id));
        onChanged();
      } else {
        const data = await res.json();
        alert(data.error || "删除失败");
      }
    } catch (err) {
      alert(`删除错误: ${String(err)}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-primary">
              自选股管理
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              {stocks.filter((s) => s.isActive).length}/{stocks.length} 监控中
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-xl leading-none px-2 py-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Search & Autocomplete */}
          <div className="relative">
            <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>🔍 快捷搜索标的（输入名称/拼音/代码直接联想）</span>
              {searching && <span className="text-[10px] text-accent animate-pulse">搜索中...</span>}
            </div>
            <input
              type="text"
              placeholder="例如输入：宁德时代 / 茅台 / 特斯拉 / 300750 / NVDA / 腾讯"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-lg bg-surface border border-accent/40 focus:outline-none focus:border-accent text-text-primary placeholder:text-text-secondary/60 shadow-inner"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface border border-border/90 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-border/40">
                {searchResults.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => selectSearchResult(item)}
                    className="w-full px-3.5 py-2 text-left hover:bg-surface-hover/80 flex items-center justify-between transition-colors text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{item.nameCn}</span>
                      <span className="text-text-secondary font-mono text-[11px]">{item.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover border border-border text-text-secondary font-mono">
                        {item.market}
                      </span>
                      <span className="text-accent text-[11px] font-medium">点击填入 ↵</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add form */}
          <form
            onSubmit={handleAddStock}
            className="p-4 rounded-lg bg-surface-hover/50 border border-border/80 space-y-3"
          >
            <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              新增监控标的 (支持上述联想自动填入或手动输入)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <input
                  type="text"
                  placeholder="代码 如 600519.SS"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md bg-surface border border-border focus:outline-none focus:border-accent text-text-primary"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="中文简称 如 贵州茅台"
                  value={nameCn}
                  onChange={(e) => setNameCn(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md bg-surface border border-border focus:outline-none focus:border-accent text-text-primary"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="英文全称 (选填)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md bg-surface border border-border focus:outline-none focus:border-accent text-text-primary"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={market}
                  onChange={(e) =>
                    setMarket(e.target.value as "US" | "HK" | "CN" | "INDEX")
                  }
                  className="text-xs px-2.5 py-2 rounded-md bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="CN">A股</option>
                  <option value="HK">港股</option>
                  <option value="US">美股</option>
                  <option value="INDEX">指数</option>
                </select>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-accent hover:bg-accent/90 text-white text-xs font-medium py-2 px-3 rounded-md transition-colors disabled:opacity-50"
                >
                  {submitting ? "添加中..." : "+ 添加"}
                </button>
              </div>
            </div>
          </form>

          {/* List */}
          {error && (
            <div className="text-xs text-down bg-down/10 p-2.5 rounded border border-down/20">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-text-secondary">
              加载中...
            </div>
          ) : stocks.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-secondary">
              暂无自选股，可通过上方表单添加
            </div>
          ) : (
            <div className="border border-border/70 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-hover/80 border-b border-border text-text-secondary">
                    <th className="py-2.5 px-3 font-medium">标的</th>
                    <th className="py-2.5 px-3 font-medium">市场</th>
                    <th className="py-2.5 px-3 font-medium text-right">价格</th>
                    <th className="py-2.5 px-3 font-medium text-center">监控状态</th>
                    <th className="py-2.5 px-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {stocks.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-text-primary">
                          {s.nameCn}
                        </div>
                        <div className="text-[11px] text-text-secondary font-mono">
                          {s.symbol}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary">
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px]">
                          {s.market}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-primary">
                        {s.price != null ? s.price.toFixed(2) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(s.id, s.isActive)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                            s.isActive
                              ? "bg-up/15 text-up hover:bg-up/25"
                              : "bg-text-secondary/15 text-text-secondary hover:bg-text-secondary/25"
                          }`}
                        >
                          {s.isActive ? "监控中" : "已停用"}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteStock(s.id, s.symbol)}
                          className="text-text-secondary hover:text-down px-2 py-1 rounded text-xs transition-colors"
                          title="移除自选"
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface-hover/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-surface border border-border text-text-primary hover:bg-surface-hover transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
