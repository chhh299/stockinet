import { prisma } from "../db";
import { getActiveAdapters } from "../sources";
import { RawArticle } from "../sources/types";
import { groupSimilarArticles } from "./dedup";
import { summarizeArticles, filterRelevantArticles } from "./summarize";
import { seedInitialStocks } from "../stocks-seed";

const BATCH_SIZE = 2;

export async function fetchAndProcessNewsBatch(
  batch: number,
  skipAi = false,
  targetSymbol?: string
): Promise<{
  articlesFetched: number;
  clustersCreated: number;
  batchesTotal: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const allRawArticles: RawArticle[] = [];

  // Ensure initial stocks seeded if empty
  await seedInitialStocks();

  // Retrieve active stocks from database
  let activeStocks = await prisma.stock.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  if (targetSymbol) {
    activeStocks = activeStocks.filter((s) => s.symbol.toUpperCase() === targetSymbol.toUpperCase());
  }

  // If batch === -1, process ALL active stocks in one run
  let batchStocks = activeStocks;
  const batchesTotal = Math.max(1, Math.ceil(activeStocks.length / BATCH_SIZE));

  if (batch >= 0) {
    const start = batch * BATCH_SIZE;
    batchStocks = activeStocks.slice(start, start + BATCH_SIZE);
  }

  if (batchStocks.length === 0) {
    return { articlesFetched: 0, clustersCreated: 0, batchesTotal, errors: ["Invalid batch or no active stocks"] };
  }

  // 全部股票并发并行抓取，彻底避免串行等待导致的 Vercel 30 秒超时 500 错误
  await Promise.allSettled(
    batchStocks.map(async (stock) => {
      const adapters = getActiveAdapters(stock.market);
      const results = await Promise.allSettled(
        adapters.map((adapter) =>
          adapter.fetch({
            symbol: stock.symbol,
            name: stock.name,
            nameCn: stock.nameCn,
            market: stock.market,
            stockId: stock.id,
          })
        )
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const adapter = adapters[i];
        if (result.status === "fulfilled") {
          // 对 A 股 / 港股新闻进行强校验过滤：标题或摘要必须包含股票名称或纯数字代码，杜绝无关英文/宏观噪音
          const validArticles = result.value.filter((art) => {
            if (stock.market === "CN" || stock.market === "HK") {
              const cleanCode = stock.symbol.replace(/\.(SS|SZ|HK)/i, "");
              const text = `${art.title} ${art.snippet}`;
              const matchesName = stock.nameCn && text.includes(stock.nameCn);
              const matchesCode = cleanCode.length >= 4 && text.includes(cleanCode);
              return matchesName || matchesCode;
            }
            return true;
          });

          allRawArticles.push(...validArticles);
        } else {
          errors.push(`Fetch error for ${stock.symbol} via ${adapter.id}: ${result.reason}`);
        }
      }
    })
  );

  // 关键修复：入库聚类前，必须将全网抓回来的所有原始文章按发布时间绝对倒序排序！
  // 确保今天 (9月14日) 和最近两天的最新消息排在最前面，绝不让两周前的历史旧闻抢占入库名额
  allRawArticles.sort((a, b) => {
    const timeA = a.publishedAt ? a.publishedAt.getTime() : 0;
    const timeB = b.publishedAt ? b.publishedAt.getTime() : 0;
    return timeB - timeA;
  });

  const allGroups = groupSimilarArticles(allRawArticles);
  // 聚类组同样按最新时间倒序，优先保留最新的前 25 个新鲜聚簇
  allGroups.sort((a, b) => {
    const tA = a.articles[0]?.publishedAt ? a.articles[0].publishedAt.getTime() : 0;
    const tB = b.articles[0]?.publishedAt ? b.articles[0].publishedAt.getTime() : 0;
    return tB - tA;
  });

  const groups = allGroups.slice(0, 25);
  let clustersCreated = 0;

  // 使用并发并行处理聚类入库，避免串行 await 耗尽 Serverless 10 秒时间窗口
  await Promise.allSettled(
    groups.map(async (group) => {
      if (group.articles.length === 0) return;

      const primaryArticle = group.articles[0];
      const stockId = primaryArticle.stockId;

      const existing = await prisma.article.findFirst({
        where: { url: primaryArticle.url },
      });
      if (existing) return;

      const dbStock = await prisma.stock.findUnique({ where: { id: stockId } });
      let filteredArticles = group.articles;
      if (dbStock && group.articles.length > 0) {
        const relevantIndices = await filterRelevantArticles(
          dbStock.nameCn,
          dbStock.symbol,
          group.articles.map((a) => ({ title: a.title, snippet: a.snippet }))
        );
        if (relevantIndices.length > 0) {
          filteredArticles = relevantIndices
            .map((i) => group.articles[i])
            .filter(Boolean);
        }
      }

      const createdArticles = await Promise.all(
        filteredArticles.map((a) =>
          prisma.article.create({
            data: {
              stockId: a.stockId,
              title: a.title,
              snippet: a.snippet,
              url: a.url,
              source: a.source,
              publishedAt: a.publishedAt,
            },
          })
        )
      );

      const titles = filteredArticles.map((a) => a.title);

      let aiSummary: string | null = null;
      let keyPoints: string[] = [];
      if (!skipAi && dbStock) {
        const result = await summarizeArticles(dbStock.nameCn, dbStock.symbol, titles);
        if (result) {
          aiSummary = result.summary;
          keyPoints = result.keyPoints;
        }
      }

      const filteredSourceTypes = new Set(filteredArticles.map((a) => a.source));
      const verificationStatus =
        filteredSourceTypes.size >= 2 ? "verified" : "unverified";

      await prisma.newsCluster.create({
        data: {
          title: filteredArticles[0]?.title || group.canonicalTitle,
          aiSummary,
          keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
          verificationStatus,
          sourceCount: filteredSourceTypes.size,
          publishedAt: primaryArticle.publishedAt,
          articles: {
            create: createdArticles.map((a) => ({ articleId: a.id })),
          },
        },
      });

      clustersCreated++;
    })
  );

  // Cleanup only on last batch (严格清理 7 天前过期记录)
  if (batch === batchesTotal - 1) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.newsCluster.deleteMany({ where: { publishedAt: { lt: sevenDaysAgo } } });
    await prisma.article.deleteMany({ where: { publishedAt: { lt: sevenDaysAgo } } });
  }

  return { articlesFetched: allRawArticles.length, clustersCreated, batchesTotal, errors };
}

export async function fetchAndProcessAllNews(): Promise<{
  articlesFetched: number;
  clustersCreated: number;
  errors: string[];
}> {
  await seedInitialStocks();
  const activeCount = await prisma.stock.count({ where: { isActive: true } });
  const batchesTotal = Math.max(1, Math.ceil(activeCount / BATCH_SIZE));

  let totalArticles = 0;
  let totalClusters = 0;
  const allErrors: string[] = [];

  for (let b = 0; b < batchesTotal; b++) {
    const result = await fetchAndProcessNewsBatch(b);
    totalArticles += result.articlesFetched;
    totalClusters += result.clustersCreated;
    allErrors.push(...result.errors);
  }

  return { articlesFetched: totalArticles, clustersCreated: totalClusters, errors: allErrors };
}
