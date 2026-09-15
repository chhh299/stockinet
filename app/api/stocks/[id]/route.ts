import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_MARKETS = ["US", "HK", "CN", "INDEX"] as const;
type MarketType = (typeof VALID_MARKETS)[number];

// PATCH /api/stocks/[id]
// Body: { isActive?: boolean, name?: string, nameCn?: string, market?: string }
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "无效的标的 ID" }, { status: 400 });
    }

    const existing = await prisma.stock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "标的不存在" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: {
      isActive?: boolean;
      name?: string;
      nameCn?: string;
      market?: MarketType;
    } = {};

    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }
    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (typeof body.nameCn === "string" && body.nameCn.trim()) {
      updateData.nameCn = body.nameCn.trim();
    }
    if (typeof body.market === "string") {
      const upper = body.market.trim().toUpperCase();
      if (VALID_MARKETS.includes(upper as MarketType)) {
        updateData.market = upper as MarketType;
      }
    }

    const updated = await prisma.stock.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ stock: updated });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE /api/stocks/[id]
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "无效的标的 ID" }, { status: 400 });
    }

    const existing = await prisma.stock.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "标的不存在" }, { status: 404 });
    }

    // 1. 查找属于该股票的文章 ID 列表
    const articles = await prisma.article.findMany({
      where: { stockId: id },
      select: { id: true },
    });
    const articleIds = articles.map((a) => a.id);

    if (articleIds.length > 0) {
      // 2. 查找关联这些文章的聚簇 ID
      const clusterLinks = await prisma.clusterArticle.findMany({
        where: { articleId: { in: articleIds } },
        select: { clusterId: true },
      });
      const clusterIds = clusterLinks.map((cl) => cl.clusterId);

      // 3. 删除中间表与聚簇卡片，确保彻底清理干净
      if (clusterIds.length > 0) {
        await prisma.clusterArticle.deleteMany({
          where: { clusterId: { in: clusterIds } },
        });
        await prisma.newsCluster.deleteMany({
          where: { id: { in: clusterIds } },
        });
      }
    }

    // 4. Cascade 删除股票本身和其下文章
    await prisma.stock.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
