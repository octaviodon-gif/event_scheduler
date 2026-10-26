import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  UNAVAILABLE_REASON_LABELS,
  type PurchaseStatusValue,
  type UnavailableReasonValue,
} from "@/lib/purchase-status";
import PurchaseForm from "./purchase-form";
import StatusSelect from "./status-select";

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

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-300 dark:border-neutral-700">
              <tr>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">In service</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Unit price</th>
                <th className="py-2 pr-4 text-right">Rental Price</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const inService = p.quantity - p.unavailableQuantity;
                return (
                  <tr key={p.purchaseId} className="border-b border-neutral-200 align-top dark:border-neutral-800">
                    <td className="py-2 pr-4">{p.assetName}</td>
                    <td className="py-2 pr-4">{p.category?.name ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {inService} of {p.quantity}
                      {p.unavailableQuantity > 0 && p.unavailableReason && (
                        <p className="text-xs text-amber-700">
                          {p.unavailableQuantity} {UNAVAILABLE_REASON_LABELS[p.unavailableReason as UnavailableReasonValue].toLowerCase()}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-4">{p.provider}</td>
                    <td className="py-2 pr-4">
                      <StatusSelect id={p.purchaseId} value={p.purchaseStatus as PurchaseStatusValue} />
                    </td>
                    <td className="py-2 pr-4 text-right">${p.price.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right">
                      {p.rentalPrice ? `$${p.rentalPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">${p.totalAmount.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <Link href={`/purchases/${p.purchaseId}/edit`} className="hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
