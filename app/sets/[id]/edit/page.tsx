import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSlotCategories } from "@/lib/set-data";
import SetForm from "../../set-form";

export const instant = false;

export default async function EditSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [slotCategories, set] = await Promise.all([
    getSlotCategories(),
    prisma.asset.findUnique({
      where: { assetId: id },
      include: { slots: true, fixedItems: true },
    }),
  ]);
  if (!set) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Link href="/sets" className="text-sm text-neutral-500 hover:underline">
        ← Set Setup
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit set</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <SetForm
          categories={slotCategories}
          initial={{
            id: set.assetId,
            name: set.assetName,
            price: set.assetPrice.toFixed(2),
            assetAmount: set.assetAmount?.toString() ?? "",
            color: set.assetColor ?? "",
            measures: set.assetMeasures ?? "",
            picks: Object.fromEntries(set.slots.map((s) => [s.categoryId, s.quantity])),
            fixed: set.fixedItems.map((f) => ({ purchaseId: f.purchaseId, quantity: f.quantity })),
          }}
        />
      </section>
    </main>
  );
}
