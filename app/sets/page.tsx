import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSlotCategories } from "@/lib/set-data";
import DeleteSetButton from "./delete-button";
import SetForm from "./set-form";

export const instant = false;

export default async function SetsPage() {
  const [slotCategories, sets] = await Promise.all([
    getSlotCategories(),
    prisma.asset.findMany({
      include: {
        slots: { include: { category: true } },
        fixedItems: { include: { purchase: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Set Setup</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <SetForm categories={slotCategories} />
      </section>

      <h2 className="mt-10 text-lg font-medium">Your sets</h2>
      {sets.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No sets yet.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {sets.map((s) => (
            <article key={s.assetId} className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{s.assetName}</h3>
                <p className="text-sm font-medium">${s.assetPrice.toFixed(2)}</p>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {s.assetAmount ? `Max ${s.assetAmount} at once` : "No limit at once"}
                {s.assetColor ? ` · ${s.assetColor}` : ""}
                {s.assetMeasures ? ` · ${s.assetMeasures}` : ""}
              </p>

              {s.fixedItems.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Always included
                  </p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {[...s.fixedItems]
                      .sort((a, b) => a.purchase.assetName.localeCompare(b.purchase.assetName))
                      .map((f) => (
                        <li key={f.purchaseId}>
                          {f.quantity} × {f.purchase.assetName}
                        </li>
                      ))}
                  </ul>
                </>
              )}

              {s.slots.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Customer picks
                  </p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {[...s.slots]
                      .sort((a, b) => a.category.name.localeCompare(b.category.name))
                      .map((slot) => (
                        <li key={slot.categoryId}>
                          {slot.quantity} × {slot.category.name}
                        </li>
                      ))}
                  </ul>
                </>
              )}

              <div className="mt-4 flex items-start gap-4 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
                <Link href={`/sets/${s.assetId}/edit`} className="hover:underline">
                  Edit
                </Link>
                <DeleteSetButton id={s.assetId} name={s.assetName} />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
