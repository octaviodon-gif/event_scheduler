"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { UserError, usableUnits } from "@/lib/inventory";

export type SetFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const uuid = /^[0-9a-f-]{36}$/i;

const schema = z.object({
  assetName: z.string().trim().min(1, "Required").max(100, "Max 100 characters"),
  assetColor: z.string().trim().max(50, "Max 50 characters"),
  assetMeasures: z.string().trim().max(100, "Max 100 characters"),
  // optional: empty = no limit
  assetAmount: z
    .string()
    .trim()
    .regex(/^([1-9]\d{0,3})?$/, "Leave empty, or enter a whole number of 1 or more"),
  assetPrice: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Use a number like 120 or 120.50"),
});

export async function createSet(
  _prev: SetFormState,
  formData: FormData,
): Promise<SetFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = schema.safeParse({
    assetName: formData.get("assetName") ?? "",
    assetColor: formData.get("assetColor") ?? "",
    assetMeasures: formData.get("assetMeasures") ?? "",
    assetAmount: formData.get("assetAmount") ?? "",
    assetPrice: formData.get("assetPrice") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  // slot_<categoryId>  = the customer picks that many from the category when booking
  // fixed_<purchaseId> = that many units of that specific item are always in the set
  const picks: { categoryId: string; quantity: number }[] = [];
  const fixed: { purchaseId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    if (key.startsWith("slot_")) {
      const categoryId = key.slice(5);
      if (uuid.test(categoryId)) picks.push({ categoryId, quantity });
    } else if (key.startsWith("fixed_")) {
      const purchaseId = key.slice(6);
      if (uuid.test(purchaseId)) fixed.push({ purchaseId, quantity });
    }
  }
  if (picks.length === 0 && fixed.length === 0) {
    return { error: "Add at least one fixed item or one category pick to the set." };
  }

  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      // Fixed items: must be completed and in service
      const fixedPurchases =
        fixed.length > 0
          ? await tx.purchase.findMany({
              where: {
                purchaseId: { in: fixed.map((f) => f.purchaseId) },
                purchaseStatus: "COMPLETED",
              },
            })
          : [];
      if (fixedPurchases.length !== fixed.length) {
        throw new UserError("Only completed purchases can be fixed in a set. Reload the page and try again.");
      }

      const fixedPerCategory = new Map<string, number>();
      for (const f of fixed) {
        const p = fixedPurchases.find((x) => x.purchaseId === f.purchaseId)!;
        const usable = p.quantity - p.unavailableQuantity;
        if (f.quantity > usable) {
          throw new UserError(`You only have ${usable} usable unit(s) of "${p.assetName}".`);
        }
        if (p.categoryId) {
          fixedPerCategory.set(p.categoryId, (fixedPerCategory.get(p.categoryId) ?? 0) + f.quantity);
        }
      }

      // Category picks: the category must still have enough left after the fixed items
      const ids = picks.map((c) => c.categoryId);
      const categories =
        ids.length > 0 ? await tx.category.findMany({ where: { categoryId: { in: ids } } }) : [];
      if (categories.length !== ids.length) {
        throw new UserError("One of the categories no longer exists. Reload the page and try again.");
      }

      for (const c of picks) {
        const have = await usableUnits(tx, c.categoryId);
        const taken = fixedPerCategory.get(c.categoryId) ?? 0;
        if (c.quantity > have - taken) {
          const name = categories.find((x) => x.categoryId === c.categoryId)?.name ?? "this category";
          throw new UserError(
            `"${name}" has ${have} usable item(s) and ${taken} of them are always included in this set, so the customer can pick at most ${Math.max(have - taken, 0)}.`,
          );
        }
      }

      await tx.asset.create({
        data: {
          assetName: d.assetName,
          assetColor: d.assetColor || null,
          assetMeasures: d.assetMeasures || null,
          assetAmount: d.assetAmount === "" ? null : Number(d.assetAmount),
          assetPrice: new Prisma.Decimal(d.assetPrice),
          slots: { create: picks },
          fixedItems: { create: fixed },
        },
      });
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { assetName: "A set with this name already exists." } };
    }
    console.error("createSet failed:", e);
    return { error: "Could not save the set. Please try again." };
  }

  revalidatePath("/sets");
  return { ok: true };
}
