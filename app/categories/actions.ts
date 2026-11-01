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

// Creates a category from a dropdown (Register Purchases). If one with that name already exists
// (ignoring capitals), it is returned instead of making a duplicate.
export async function createCategoryInline(
  name: string,
): Promise<{ id?: string; name?: string; error?: string }> {
  const session = await auth();
  if (!session) return { error: "You are not signed in." };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };

  try {
    const existing = await prisma.category.findFirst({
      where: { name: { equals: parsed.data, mode: "insensitive" } },
    });
    const category = existing ?? (await prisma.category.create({ data: { name: parsed.data } }));
    revalidatePath("/purchases");
    revalidatePath("/sets");
    return { id: category.categoryId, name: category.name };
  } catch (e) {
    console.error("createCategoryInline failed", e);
    return { error: "Could not save the category. Please try again." };
  }
}
