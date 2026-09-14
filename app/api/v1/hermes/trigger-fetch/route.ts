import { NextRequest, NextResponse } from "next/server";
import { authenticateHermesRequest } from "@/lib/hermes/auth";
import { fetchAndProcessNewsBatch } from "@/lib/pipeline/fetch-all";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 允许最长执行 60 秒，彻底规避 Vercel 默认超时中断问题

// POST /api/v1/hermes/trigger-fetch
// Body: { symbol?: string, skipAi?: boolean }
export async function POST(request: NextRequest) {
  const auth = authenticateHermesRequest(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const skipAi = Boolean(body.skipAi);
    const symbol = body.symbol ? String(body.symbol).trim() : undefined;
    const startMs = Date.now();

    // 增加 8.5 秒安全熔断上限，防止超过 Vercel 10 秒硬限制导致网关 500
    const fetchPromise = fetchAndProcessNewsBatch(-1, skipAi, symbol);
    const timeoutPromise = new Promise<{
      articlesFetched: number;
      clustersCreated: number;
      batchesTotal: number;
      errors: string[];
    }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            articlesFetched: 0,
            clustersCreated: 0,
            batchesTotal: 1,
            errors: ["Vercel timeout guard triggered"],
          }),
        8500
      )
    );

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    const elapsedMs = Date.now() - startMs;

    return NextResponse.json({
      code: 0,
      message: "Fetch process triggered successfully",
      data: {
        articlesFetched: result.articlesFetched,
        clustersCreated: result.clustersCreated,
        elapsedMs,
        errors: result.errors,
      },
      meta: {
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { code: 500, message: `Failed to trigger fetch: ${String(error)}`, data: null },
      { status: 500 }
    );
  }
}
