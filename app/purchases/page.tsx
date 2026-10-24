import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PURCHASE_STATUS_LABELS, type PurchaseStatusValue } from "@/lib/purchase-status";
import PurchaseForm from "./purchase-form";

export const instant = false;

export default async function PurchasesPage() {
  const purchases = await prisma.purchase.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Register Purchases</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <PurchaseForm />
      </section>

      <h2 className="mt-10 text-lg font-medium">Recent purchases</h2>
      {purchases.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Nothing registered yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-300 dark:border-neutral-700">
              <tr>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Unit price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.purchaseId} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4">{p.assetName}</td>
                  <td className="py-2 pr-4">{p.quantity}</td>
                  <td className="py-2 pr-4">{p.provider}</td>
                  <td className="py-2 pr-4">
                    {PURCHASE_STATUS_LABELS[p.purchaseStatus as PurchaseStatusValue]}
                  </td>
                  <td className="py-2 pr-4 text-right">${p.price.toFixed(2)}</td>
                  <td className="py-2 text-right">${p.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
