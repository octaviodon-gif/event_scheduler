import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditForm from "./edit-form";

export const instant = false;

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [p, categories] = await Promise.all([
    prisma.purchase.findUnique({ where: { purchaseId: id } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link href="/purchases" className="text-sm text-neutral-500 hover:underline">
        ← Purchases
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit purchase</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <EditForm
          categories={categories.map((c) => ({ id: c.categoryId, name: c.name }))}
          purchase={{
            id: p.purchaseId,
            assetName: p.assetName,
            quantity: p.quantity,
            price: p.price.toFixed(2),
            rentalPrice: p.rentalPrice?.toFixed(2) ?? "",
            provider: p.provider,
            categoryId: p.categoryId ?? "",
            purchaseStatus: p.purchaseStatus,
            assetColor: p.assetColor ?? "",
            assetMeasures: p.assetMeasures ?? "",
            unavailableQuantity: p.unavailableQuantity,
            unavailableReason: p.unavailableReason ?? "",
            unavailableNote: p.unavailableNote ?? "",
          }}
        />
      </section>
    </main>
  );
}
