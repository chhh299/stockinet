import { prisma } from "./db";
import { TRACKED_STOCKS } from "./stocks";

export async function seedInitialStocks() {
  try {
    const count = await prisma.stock.count();
    if (count > 0) {
      return { seeded: false, count };
    }

    // Insert initial tracked stocks as seeds
    for (const s of TRACKED_STOCKS) {
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
    }

    const newCount = await prisma.stock.count();
    return { seeded: true, count: newCount };
  } catch (error) {
    console.error("Failed to seed initial stocks:", error);
    return { seeded: false, error: String(error) };
  }
}
