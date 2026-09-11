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

    // Cascade delete stock and associated articles
    await prisma.stock.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
