import { prisma } from "@/lib/prisma";
import type { SlotCategory } from "@/app/sets/set-form";

// Categories with the items you can use in a set: completed purchases with units in service
export async function getSlotCategories(): Promise<SlotCategory[]> {
  const [categories, purchases] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.purchase.findMany({
      where: { purchaseStatus: "COMPLETED", categoryId: { not: null } },
      orderBy: { assetName: "asc" },
    }),
  ]);

  return categories.map((c) => {
    const items = purchases
      .filter((p) => p.categoryId === c.categoryId)
      .map((p) => ({
        id: p.purchaseId,
        name: p.assetName,
        provider: p.provider,
        color: p.assetColor,
        measures: p.assetMeasures,
        usable: p.quantity - p.unavailableQuantity,
      }))
      .filter((i) => i.usable > 0);
    return {
      id: c.categoryId,
      name: c.name,
      owned: items.reduce((sum, i) => sum + i.usable, 0),
      items,
    };
  });
}
