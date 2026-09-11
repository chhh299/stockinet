import { prisma } from "./db";
import { TRACKED_STOCKS } from "./stocks";

export async function seedInitialStocks() {
  try {
    const count = await prisma.stock.count();
    if (count > 0) {
      return { seeded: false, count };
    }

    // 采用顺序安全插入，若并发已插入则忽略，避免唯一键冲突导致 500
    for (const s of TRACKED_STOCKS) {
      try {
        await prisma.stock.upsert({
          where: { symbol: s.symbol },
          update: {},
          create: {
            symbol: s.symbol,
            name: s.name,
            nameCn: s.nameCn,
            market: s.market,
            isActive: true,
            isCustom: false,
          },
        });
      } catch {
        // 忽略微秒级并发插入冲突
      }
    }

    const newCount = await prisma.stock.count();
    return { seeded: true, count: newCount };
  } catch (error) {
    console.error("Failed to seed initial stocks:", error);
    return { seeded: false, error: String(error) };
  }
}
