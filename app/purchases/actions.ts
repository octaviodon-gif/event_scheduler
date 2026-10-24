"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PURCHASE_STATUS_VALUES } from "@/lib/purchase-status";

export type PurchaseFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const schema = z.object({
  assetName: z.string().trim().min(1, "Required").max(100, "Max 100 characters"),
  quantity: z.coerce.number().int("Whole number").min(1, "At least 1"),
  provider: z.string().trim().min(1, "Required").max(150, "Max 150 characters"),
  assetColor: z.string().trim().max(50, "Max 50 characters"),
  assetMeasures: z.string().trim().max(100, "Max 100 characters"),
  purchaseStatus: z.enum(PURCHASE_STATUS_VALUES),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Use a number like 120 or 120.50"),
});

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
    price: formData.get("price") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

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
        price,
        totalAmount: price.mul(d.quantity), // total is always computed on the server
      },
    });
  } catch {
    return { error: "Could not save the purchase. Please try again." };
  }

  revalidatePath("/purchases");
  return { ok: true };
}
