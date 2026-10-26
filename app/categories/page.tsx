import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CategoryForm from "./category-form";
import DeleteCategoryButton from "./delete-button";

export const instant = false;

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true, slots: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Item categories</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Categories are the types of items you rent. Each purchase belongs to one, and a set is defined as
        “this many items of each category”.
      </p>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <CategoryForm />
      </section>

      <h2 className="mt-10 text-lg font-medium">Your categories</h2>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          None yet. Add your first one above, then register purchases and build your sets.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-300 dark:divide-neutral-800 dark:border-neutral-700">
          {categories.map((c) => (
            <li key={c.categoryId} className="flex items-start justify-between gap-4 p-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-neutral-500">
                  {c._count.purchases} purchase(s) · used in {c._count.slots} set(s)
                </p>
              </div>
              <DeleteCategoryButton id={c.categoryId} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
