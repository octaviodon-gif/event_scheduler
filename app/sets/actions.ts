"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

type ParsedSet = z.infer<typeof schema> & {
  picks: { categoryId: string; quantity: number }[];
  fixed: { purchaseId: string; quantity: number }[];
};

function parseSet(formData: FormData): { data: ParsedSet } | { state: SetFormState } {
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
    return { state: { fieldErrors } };
  }

  // slot_<categoryId> = how many the customer picks from that category when booking
  const picks: ParsedSet["picks"] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("slot_")) continue;
    const quantity = Number(value);
    const categoryId = key.slice(5);
    if (Number.isInteger(quantity) && quantity > 0 && uuid.test(categoryId)) {
      picks.push({ categoryId, quantity });
    }
  }

  // fixedItem / fixedQty = specific items always in the set (one pair per row, same order)
  const fixedIds = formData.getAll("fixedItem").map(String);
  const fixedQtys = formData.getAll("fixedQty").map(Number);
  const fixedMap = new Map<string, number>();
  fixedIds.forEach((id, i) => {
    const quantity = fixedQtys[i];
    if (!uuid.test(id) || !Number.isInteger(quantity) || quantity <= 0) return;
    fixedMap.set(id, (fixedMap.get(id) ?? 0) + quantity); // same item twice = add them up
  });
  const fixed = [...fixedMap].map(([purchaseId, quantity]) => ({ purchaseId, quantity }));

  if (picks.length === 0 && fixed.length === 0) {
    return { state: { error: "Add at least one fixed item or one category pick to the set." } };
  }

  return { data: { ...parsed.data, picks, fixed } };
}

// Throws a UserError if the set cannot be made from the inventory you have
async function checkSet(tx: Prisma.TransactionClient, d: ParsedSet) {
  // Fixed items: must be completed and in service
  const fixedPurchases =
    d.fixed.length > 0
      ? await tx.purchase.findMany({
          where: {
            purchaseId: { in: d.fixed.map((f) => f.purchaseId) },
            purchaseStatus: "COMPLETED",
          },
        })
      : [];
  if (fixedPurchases.length !== d.fixed.length) {
    throw new UserError("Only completed purchases can be fixed in a set. Reload the page and try again.");
  }

  const fixedPerCategory = new Map<string, number>();
  for (const f of d.fixed) {
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
  const ids = d.picks.map((c) => c.categoryId);
  const categories =
    ids.length > 0 ? await tx.category.findMany({ where: { categoryId: { in: ids } } }) : [];
  if (categories.length !== ids.length) {
    throw new UserError("One of the categories no longer exists. Reload the page and try again.");
  }

  for (const c of d.picks) {
    const have = await usableUnits(tx, c.categoryId);
    const taken = fixedPerCategory.get(c.categoryId) ?? 0;
    if (c.quantity > have - taken) {
      const name = categories.find((x) => x.categoryId === c.categoryId)?.name ?? "this category";
      throw new UserError(
        `"${name}" has ${have} usable item(s) and ${taken} of them are always included in this set, so the customer can pick at most ${Math.max(have - taken, 0)}.`,
      );
    }
  }
}

function baseData(d: ParsedSet) {
  return {
    assetName: d.assetName,
    assetColor: d.assetColor || null,
    assetMeasures: d.assetMeasures || null,
    assetAmount: d.assetAmount === "" ? null : Number(d.assetAmount),
    assetPrice: new Prisma.Decimal(d.assetPrice),
  };
}

function toState(e: unknown, where: string): SetFormState {
  if (e instanceof UserError) return { error: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { fieldErrors: { assetName: "A set with this name already exists." } };
  }
  console.error(`${where} failed:`, e);
  return { error: "Could not save the set. Please try again." };
}

export async function createSet(
  _prev: SetFormState,
  formData: FormData,
): Promise<SetFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const result = parseSet(formData);
  if ("state" in result) return result.state;
  const d = result.data;

  try {
    await prisma.$transaction(async (tx) => {
      await checkSet(tx, d);
      await tx.asset.create({
        data: {
          ...baseData(d),
          slots: { create: d.picks },
          fixedItems: { create: d.fixed },
        },
      });
    });
  } catch (e) {
    return toState(e, "createSet");
  }

  revalidatePath("/sets");
  return { ok: true };
}

export async function updateSet(
  _prev: SetFormState,
  formData: FormData,
): Promise<SetFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const assetId = String(formData.get("assetId") ?? "");
  if (!uuid.test(assetId)) return { error: "Invalid set." };

  const result = parseSet(formData);
  if ("state" in result) return result.state;
  const d = result.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.asset.findUnique({ where: { assetId } });
      if (!existing) throw new UserError("This set no longer exists.");

      await checkSet(tx, d);
      // replace the whole composition with what the form now says
      await tx.assetSlot.deleteMany({ where: { assetId } });
      await tx.assetFixedItem.deleteMany({ where: { assetId } });
      await tx.asset.update({
        where: { assetId },
        data: {
          ...baseData(d),
          slots: { create: d.picks },
          fixedItems: { create: d.fixed },
        },
      });
    });
  } catch (e) {
    return toState(e, "updateSet");
  }

  revalidatePath("/sets");
  redirect("/sets"); // outside the try/catch on purpose
}

export async function deleteSet(assetId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };
  if (!uuid.test(assetId)) return { error: "Invalid set." };

  const booked = await prisma.eventAsset.count({ where: { assetId } });
  if (booked > 0) {
    return { error: `This set has been booked in ${booked} event(s), so it can't be deleted.` };
  }

  try {
    await prisma.asset.delete({ where: { assetId } }); // its fixed items and picks go with it
  } catch (e) {
    console.error("deleteSet failed:", e);
    return { error: "Could not delete the set." };
  }

  revalidatePath("/sets");
  return { ok: true };
}
