"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { assertSetsStillFit, UserError } from "@/lib/inventory";
import {
  PURCHASE_STATUS_VALUES,
  UNAVAILABLE_REASON_VALUES,
  type UnavailableReasonValue,
} from "@/lib/purchase-status";

export type PurchaseFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const uuid = /^[0-9a-f-]{36}$/i;

const schema = z.object({
  assetName: z.string().trim().min(1, "Required").max(100, "Max 100 characters"),
  quantity: z.coerce.number().int("Whole number").min(1, "At least 1"),
  provider: z.string().trim().min(1, "Required").max(150, "Max 150 characters"),
  assetColor: z.string().trim().max(50, "Max 50 characters"),
  assetMeasures: z.string().trim().max(100, "Max 100 characters"),
  purchaseStatus: z.enum(PURCHASE_STATUS_VALUES),
  categoryId: z.string().regex(uuid, "Pick a category"),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Use a number like 120 or 120.50"),
  rentalPrice: z
    .string()
    .trim()
    .regex(/^(\d{1,8}(\.\d{1,2})?)?$/, "Use a number like 50 or 50.50, or leave empty"),
});

function collectFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function createPurchase(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = schema.safeParse({
    assetName: formData.get("assetName") ?? "",
    quantity: formData.get("quantity") ?? "",
    provider: formData.get("provider") ?? "",
    assetColor: formData.get("assetColor") ?? "",
    assetMeasures: formData.get("assetMeasures") ?? "",
    purchaseStatus: formData.get("purchaseStatus") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    price: formData.get("price") ?? "",
    rentalPrice: formData.get("rentalPrice") ?? "",
  });

  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error) };

  const d = parsed.data;
  const price = new Prisma.Decimal(d.price);

  try {
    await prisma.purchase.create({
      data: {
        assetName: d.assetName,
        quantity: d.quantity,
        provider: d.provider,
        assetColor: d.assetColor || null,
        assetMeasures: d.assetMeasures || null,
        purchaseStatus: d.purchaseStatus,
        categoryId: d.categoryId,
        price,
        rentalPrice: d.rentalPrice === "" ? null : new Prisma.Decimal(d.rentalPrice),
        totalAmount: price.mul(d.quantity), // total is always computed on the server
      },
    });
  } catch (e) {
    console.error("createPurchase failed:", e);
    return { error: "Could not save the purchase. Please try again." };
  }

  revalidatePath("/purchases");
  return { ok: true };
}

const editSchema = schema.extend({
  purchaseId: z.string().regex(uuid, "Invalid purchase"),
  unavailableQuantity: z.coerce.number().int("Whole number").min(0, "Cannot be negative"),
  unavailableReason: z.string(),
  unavailableNote: z.string().trim().max(255, "Max 255 characters"),
});

export async function updatePurchase(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = editSchema.safeParse({
    purchaseId: formData.get("purchaseId") ?? "",
    assetName: formData.get("assetName") ?? "",
    quantity: formData.get("quantity") ?? "",
    provider: formData.get("provider") ?? "",
    assetColor: formData.get("assetColor") ?? "",
    assetMeasures: formData.get("assetMeasures") ?? "",
    purchaseStatus: formData.get("purchaseStatus") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    price: formData.get("price") ?? "",
    rentalPrice: formData.get("rentalPrice") ?? "",
    unavailableQuantity: formData.get("unavailableQuantity") ?? "0",
    unavailableReason: formData.get("unavailableReason") ?? "",
    unavailableNote: formData.get("unavailableNote") ?? "",
  });

  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error) };

  const d = parsed.data;
  const reason = (UNAVAILABLE_REASON_VALUES as readonly string[]).includes(d.unavailableReason)
    ? (d.unavailableReason as UnavailableReasonValue)
    : null;

  const fieldErrors: Record<string, string> = {};
  if (d.unavailableQuantity > d.quantity) {
    fieldErrors.unavailableQuantity = "Cannot be more than the quantity";
  }
  if (d.unavailableQuantity > 0 && !reason) {
    fieldErrors.unavailableReason = "Choose a reason";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const outOfService = d.unavailableQuantity > 0;
  const price = new Prisma.Decimal(d.price);

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.purchase.findUnique({ where: { purchaseId: d.purchaseId } });
      if (!current) throw new UserError("This purchase no longer exists.");

      if (d.purchaseStatus !== "COMPLETED") {
        const inEvents = await tx.eventItem.count({ where: { purchaseId: d.purchaseId } });
        if (inEvents > 0) {
          throw new UserError("This purchase is already picked in an event, so it must stay completed.");
        }
      }

      await tx.purchase.update({
        where: { purchaseId: d.purchaseId },
        data: {
          assetName: d.assetName,
          quantity: d.quantity,
          provider: d.provider,
          assetColor: d.assetColor || null,
          assetMeasures: d.assetMeasures || null,
          purchaseStatus: d.purchaseStatus,
          categoryId: d.categoryId,
          price,
          rentalPrice: d.rentalPrice === "" ? null : new Prisma.Decimal(d.rentalPrice),
          totalAmount: price.mul(d.quantity),
          unavailableQuantity: d.unavailableQuantity,
          unavailableReason: outOfService ? reason : null,
          unavailableNote: outOfService ? d.unavailableNote || null : null,
        },
      });

      // The old and the new category must both still be able to supply the sets that use them
      await assertSetsStillFit(tx, [current.categoryId, d.categoryId], [d.purchaseId]);
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    console.error("updatePurchase failed:", e);
    return { error: "Could not save the changes. Please try again." };
  }

  revalidatePath("/purchases");
  revalidatePath("/sets");
  redirect("/purchases"); // outside the try/catch on purpose
}

export async function updatePurchaseStatus(
  purchaseId: string,
  status: string,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = z.enum(PURCHASE_STATUS_VALUES).safeParse(status);
  if (!parsed.success || !uuid.test(purchaseId)) {
    return { error: "Invalid status." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data !== "COMPLETED") {
        const inEvents = await tx.eventItem.count({ where: { purchaseId } });
        if (inEvents > 0) {
          throw new UserError("This purchase is already picked in an event, so it must stay completed.");
        }
      }
      const updated = await tx.purchase.update({
        where: { purchaseId },
        data: { purchaseStatus: parsed.data },
      });
      await assertSetsStillFit(tx, [updated.categoryId], [purchaseId]);
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    console.error("updatePurchaseStatus failed:", e);
    return { error: "Could not update the status." };
  }

  revalidatePath("/purchases");
  revalidatePath("/sets");
  return { ok: true };
}
