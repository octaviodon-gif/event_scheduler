import type { Prisma } from "@/generated/prisma/client";

// An error whose message is safe to show to the user
export class UserError extends Error {}

// Units you can actually use in a category: completed purchases, minus units out of service
export async function usableUnits(tx: Prisma.TransactionClient, categoryId: string) {
  const r = await tx.purchase.aggregate({
    where: { categoryId, purchaseStatus: "COMPLETED" },
    _sum: { quantity: true, unavailableQuantity: true },
  });
  return (r._sum.quantity ?? 0) - (r._sum.unavailableQuantity ?? 0);
}

// Run inside a transaction AFTER a change to a purchase. Throws (and so rolls the change back)
// if a set would no longer be completable:
//  1. a specific item fixed in a set must still have enough usable units
//  2. each category must still supply what its sets let the customer pick,
//     on top of the fixed items that come from that same category
export async function assertSetsStillFit(
  tx: Prisma.TransactionClient,
  categoryIds: (string | null)[],
  purchaseIds: string[],
) {
  // 1. fixed items
  for (const purchaseId of new Set(purchaseIds)) {
    const fixed = await tx.assetFixedItem.aggregate({
      where: { purchaseId },
      _max: { quantity: true },
    });
    const needed = fixed._max.quantity ?? 0;
    if (needed === 0) continue;

    const p = await tx.purchase.findUnique({ where: { purchaseId } });
    const have = p && p.purchaseStatus === "COMPLETED" ? p.quantity - p.unavailableQuantity : 0;
    if (have < needed) {
      throw new UserError(
        `A set always includes ${needed} of "${p?.assetName ?? "this item"}", but this change would leave only ${have} usable. Edit the set first.`,
      );
    }
  }

  // 2. category picks
  for (const categoryId of new Set(categoryIds.filter((x): x is string => !!x))) {
    const sets = await tx.asset.findMany({
      where: { slots: { some: { categoryId } } },
      include: {
        slots: { where: { categoryId } },
        fixedItems: { include: { purchase: { select: { categoryId: true } } } },
      },
    });
    if (sets.length === 0) continue;

    let needed = 0;
    for (const set of sets) {
      const picks = set.slots[0]?.quantity ?? 0;
      const fixedHere = set.fixedItems
        .filter((f) => f.purchase.categoryId === categoryId)
        .reduce((sum, f) => sum + f.quantity, 0);
      needed = Math.max(needed, picks + fixedHere);
    }

    const have = await usableUnits(tx, categoryId);
    if (have < needed) {
      const cat = await tx.category.findUnique({ where: { categoryId } });
      throw new UserError(
        `A set needs ${needed} "${cat?.name ?? "item"}" item(s) in total, but this change would leave only ${have} usable. Edit the set first, or keep more units available.`,
      );
    }
  }
}
