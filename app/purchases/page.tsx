import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PurchaseForm from "./purchase-form";
import PurchaseList from "./purchase-list";

export const instant = false;

export default async function PurchasesPage() {
  const [purchases, categories] = await Promise.all([
    prisma.purchase.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Register Purchases</h1>

      <section className="mt-6 rounded-2xl border border-violet-200 bg-white shadow-sm p-5 dark:border-neutral-700">
        <PurchaseForm categories={categories.map((c) => ({ id: c.categoryId, name: c.name }))} />
      </section>

      <h2 className="mt-10 text-lg font-medium">Purchases</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Only completed purchases count as items you can rent out, and only the units that are in service.
        Use Edit to fix a mistake or to mark units as in maintenance or retired.
      </p>
      {purchases.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Nothing registered yet.</p>
      ) : (
        <PurchaseList
          rows={purchases.map((p) => ({
            id: p.purchaseId,
            name: p.assetName,
            category: p.category?.name ?? null,
            provider: p.provider,
            quantity: p.quantity,
            unavailableQuantity: p.unavailableQuantity,
            unavailableReason: p.unavailableReason,
            status: p.purchaseStatus,
            price: Number(p.price),
            rentalPrice: p.rentalPrice ? Number(p.rentalPrice) : null,
            total: Number(p.totalAmount),
          }))}
        />
      )}
    </main>
  );
}
