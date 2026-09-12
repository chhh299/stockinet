import { formatDistanceToNow } from "./time-utils";

interface NewsCardProps {
  id: number;
  title: string;
  aiSummary: string | null;
  keyPoints: string[] | null;
  verificationStatus: "verified" | "unverified";
  sourceCount: number;
  publishedAt: string;
  stock: {
    symbol: string;
    nameCn: string;
    market: string;
  } | null;
  sources: {
    title: string;
    url: string;
    source: string;
  }[];
}

export function NewsCard({
  title,
  aiSummary,
  keyPoints,
  verificationStatus,
  sourceCount,
  publishedAt,
  stock,
  sources,
}: NewsCardProps) {
  const isVerified = verificationStatus === "verified";
  const timeAgo = formatDistanceToNow(new Date(publishedAt));

  const primaryUrl = sources[0]?.url;

  return (
    <article className="bg-surface rounded-lg border border-border p-4 hover:border-accent/40 transition-colors group">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {stock && (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium flex items-center gap-1">
            <span>{stock.nameCn}</span>
            <span className="text-[11px] opacity-80 font-mono">({stock.symbol})</span>
          </span>
        )}
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${
            isVerified
              ? "bg-badge-verified/30 text-up"
              : "bg-badge-unverified/30 text-yellow-400"
          }`}
        >
          {isVerified
            ? `已核验 (${sourceCount}源)`
            : `待验证 (${sourceCount}源)`}
        </span>
        <span className="text-xs text-text-secondary ml-auto">{timeAgo}</span>
      </div>

      {/* 标题支持直接点击查看原文 */}
      <h3 className="text-sm font-semibold mb-2 leading-relaxed">
        {primaryUrl ? (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent hover:underline transition-colors inline-flex items-center gap-1.5"
            title="点击在新窗口打开原始报道"
          >
            <span>{title}</span>
            <span className="text-xs opacity-60 text-accent group-hover:opacity-100">↗</span>
          </a>
        ) : (
          <span>{title}</span>
        )}
      </h3>

      {aiSummary && (
        <p className="text-sm text-text-secondary mb-3 leading-relaxed">
          {aiSummary}
        </p>
      )}

      {keyPoints && keyPoints.length > 0 && (
        <ul className="mb-3 space-y-1">
          {keyPoints.map((kp, i) => (
            <li key={i} className="text-xs text-text-secondary flex gap-1.5">
              <span className="text-accent mt-0.5">•</span>
              {kp}
            </li>
          ))}
        </ul>
      )}

      {/* 底部来源与直达跳转 */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="shrink-0 text-text-secondary/70">信源：</span>
          {sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-surface-hover/80 hover:bg-accent/15 text-accent font-medium transition-colors"
              title="点击在新窗口直接跳转查看原报道"
            >
              <span>{sourceLabel(s.source)}</span>
              <span className="text-[10px]">↗</span>
            </a>
          ))}
        </div>

        {primaryUrl && (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-accent/90 hover:text-accent hover:underline shrink-0 inline-flex items-center gap-0.5 font-medium ml-auto"
          >
            <span>查看原文</span>
            <span>→</span>
          </a>
        )}
      </div>
    </article>
  );
}

function sourceLabel(source: string): string {
  switch (source) {
    case "finnhub":
      return "Finnhub";
    case "googlenews":
      return "Google News";
    case "yahoo":
      return "Yahoo Finance";
    case "eastmoney":
      return "东方财富";
    case "tencent":
      return "腾讯财经";
    case "cls":
      return "财联社";
    case "sina":
      return "新浪财经";
    case "ths":
      return "同花顺直播";
    case "research":
      return "券商研报";
    default:
      return source;
  }
}
