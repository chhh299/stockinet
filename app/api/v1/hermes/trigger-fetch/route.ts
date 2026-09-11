import { NextRequest, NextResponse } from "next/server";
import { authenticateHermesRequest } from "@/lib/hermes/auth";
import { fetchAndProcessNewsBatch } from "@/lib/pipeline/fetch-all";

export const dynamic = "force-dynamic";

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

    // 默认执行全量或指定股票的并发抓取 (-1 表示全量)
    const result = await fetchAndProcessNewsBatch(-1, skipAi, symbol);
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
