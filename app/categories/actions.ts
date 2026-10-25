"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type CategoryFormState = { ok?: boolean; error?: string };

const nameSchema = z.string().trim().min(1, "Enter a name").max(50, "Max 50 characters");

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = nameSchema.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };

  try {
    await prisma.category.create({ data: { name: parsed.data } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That category already exists." };
    }
    return { error: "Could not save the category. Please try again." };
  }

  revalidatePath("/categories");
  revalidatePath("/purchases");
  revalidatePath("/sets");
  return { ok: true };
}

export async function deleteCategory(
  categoryId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };
  if (!/^[0-9a-f-]{36}$/i.test(categoryId)) return { error: "Invalid category." };

  try {
    await prisma.category.delete({ where: { categoryId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "This category is used by purchases or sets, so it can't be deleted." };
    }
    return { error: "Could not delete the category." };
  }

  revalidatePath("/categories");
  revalidatePath("/purchases");
  revalidatePath("/sets");
  return { ok: true };
}
