import { RawArticle } from "../sources/types";

export interface ArticleGroup {
  canonicalTitle: string;
  articles: RawArticle[];
  sourceTypes: Set<string>;
}

// 借鉴自 a-share-research-monitor 的核心金融动作信号词表
const SIGNAL_TERMS = [
  "公告",
  "披露",
  "发布",
  "最新",
  "进展",
  "回购",
  "增持",
  "减持",
  "定增",
  "分红",
  "业绩",
  "预告",
  "快报",
  "年报",
  "季报",
  "中报",
  "合同",
  "中标",
  "诉讼",
  "仲裁",
  "处罚",
  "立案",
  "问询",
  "澄清",
  "停牌",
  "复牌",
  "重组",
  "投资",
  "评级",
  "买入",
  "增持",
];

/**
 * 文本清洗与标准化
 */
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[【】\[\]（）()丨|—_·\s\t\r\n]+/g, "")
    .trim();
}

/**
 * 中文字符 2-gram 窗口切分 (中文友好的无字典轻量切分)
 */
function charNgrams(text: string, n = 2): Set<string> {
  const cleaned = cleanText(text);
  if (cleaned.length <= n) {
    return cleaned ? new Set([cleaned]) : new Set();
  }
  const ngrams = new Set<string>();
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.slice(i, i + n));
  }
  return ngrams;
}

/**
 * 提取英文/数字 token 与金融信号关键词
 */
function extractTokens(text: string): Set<string> {
  const cleaned = cleanText(text);
  const tokens = new Set<string>();

  // 匹配英文字母与数字组合 (如 600519, Q1, A股 等)
  const alphaNums = cleaned.match(/[a-z0-9]+/g) || [];
  for (const item of alphaNums) {
    if (item.length >= 2) tokens.add(item);
  }

  // 匹配金融关键动作词
  for (const term of SIGNAL_TERMS) {
    if (cleaned.includes(term)) {
      tokens.add(term);
    }
  }

  return tokens;
}

/**
 * Jaccard 集合交并比计算
 */
function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersectionSize = 0;
  for (const elem of setA) {
    if (setB.has(elem)) {
      intersectionSize++;
    }
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0.0 : intersectionSize / unionSize;
}

/**
 * 最长公共子序列比率 (Sequence Matcher Ratio)
 */
function sequenceSimilarity(a: string, b: string): number {
  const cleanA = cleanText(a);
  const cleanB = cleanText(b);
  if (!cleanA || !cleanB) return 0.0;
  if (cleanA === cleanB) return 1.0;

  const m = cleanA.length;
  const n = cleanB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (cleanA[i - 1] === cleanB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs = dp[m][n];
  return (2.0 * lcs) / (m + n);
}

/**
 * 借鉴 a-share-research-monitor 的中文金融混合语义相似度计算
 */
export function calculateSemanticSimilarity(left: string, right: string): number {
  const leftClean = cleanText(left);
  const rightClean = cleanText(right);

  if (!leftClean || !rightClean) return 0.0;
  if (leftClean === rightClean) return 1.0;

  // 1. 字符 2-gram 重合度
  const ngramScore = jaccardSimilarity(charNgrams(leftClean, 2), charNgrams(rightClean, 2));

  // 2. 关键金融信号词与代号重合度
  const tokenScore = jaccardSimilarity(extractTokens(leftClean), extractTokens(rightClean));

  // 3. 序列结构相似度
  const seqScore = sequenceSimilarity(leftClean, rightClean);

  // 综合加权评分
  let score = Math.max(ngramScore, 0.65 * tokenScore + 0.35 * seqScore, seqScore * 0.9);

  // 金融信号强对齐加权：如果字符重合度高且同时包含 2 个相同的核心金融信号词，大幅判定为同主题
  const sharedSignals = SIGNAL_TERMS.filter((term) => leftClean.includes(term) && rightClean.includes(term));
  if (ngramScore >= 0.5 && sharedSignals.length >= 2) {
    score = Math.max(score, 0.82);
  }

  return score;
}

/**
 * 对抓取回来的多源新闻进行多维度语义聚类去重
 */
export function groupSimilarArticles(allArticles: RawArticle[]): ArticleGroup[] {
  const groups: ArticleGroup[] = [];
  const now = Date.now();
  // 聚类窗口放宽至 30 天，全面呈现近期月度财报、大宗交易、研报评级与重要公告
  const windowMs = 30 * 24 * 60 * 60 * 1000;

  for (const article of allArticles) {
    const pubTime = article.publishedAt ? article.publishedAt.getTime() : now;
    if (isNaN(pubTime) || now - pubTime > windowMs) continue;

    let matched = false;

    for (const group of groups) {
      for (const existing of group.articles) {
        // 同一股票标的优先聚类；不同标的若是同名宏观事件亦可参与计算
        const similarity = calculateSemanticSimilarity(article.title, existing.title);
        // 相似度阈值适度微调至 0.72：确保真正相同主题的报道才合并，避免把完全不同的新闻强行合并吞掉
        if (similarity >= 0.72) {
          group.articles.push(article);
          group.sourceTypes.add(article.source);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      groups.push({
        canonicalTitle: article.title,
        articles: [article],
        sourceTypes: new Set([article.source]),
      });
    }
  }

  return groups.filter((g) => g.canonicalTitle.length >= 4);
}
