import { prisma } from "@/lib/prisma";
import type { CatalogItem, CatalogSet } from "@/app/events/event-form";

// Sets and rentable items for the event form.
// keepItemIds: items already used by the event being edited, kept even if they are out of service now.
export async function getEventCatalog(keepItemIds: string[] = []) {
  const [sets, purchases] = await Promise.all([
    prisma.asset.findMany({
      include: {
        slots: { include: { category: true } },
        fixedItems: { include: { purchase: true } },
      },
      orderBy: { assetName: "asc" },
    }),
    prisma.purchase.findMany({
      where: { purchaseStatus: "COMPLETED", categoryId: { not: null } },
      include: { category: true },
      orderBy: { assetName: "asc" },
    }),
  ]);

  const keep = new Set(keepItemIds);

  const items: CatalogItem[] = purchases
    .filter((p) => p.quantity - p.unavailableQuantity > 0 || keep.has(p.purchaseId))
    .map((p) => ({
      id: p.purchaseId,
      name: p.assetName,
      categoryId: p.categoryId!,
      categoryName: p.category!.name,
      color: p.assetColor,
      measures: p.assetMeasures,
      rentalPrice: p.rentalPrice ? p.rentalPrice.toFixed(2) : null,
    }));

  const catalogSets: CatalogSet[] = sets.map((s) => ({
    id: s.assetId,
    name: s.assetName,
    price: s.assetPrice.toFixed(2),
    fixed: s.fixedItems.map((f) => ({
      purchaseId: f.purchaseId,
      name: f.purchase.assetName,
      quantity: f.quantity,
    })),
    slots: s.slots.map((sl) => ({
      categoryId: sl.categoryId,
      categoryName: sl.category.name,
      quantity: sl.quantity,
    })),
  }));

  return { sets: catalogSets, items };
}
