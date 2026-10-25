"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { updatePurchase, type PurchaseFormState } from "../../actions";
import {
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_VALUES,
  UNAVAILABLE_REASON_LABELS,
  UNAVAILABLE_REASON_VALUES,
} from "@/lib/purchase-status";

export type EditablePurchase = {
  id: string;
  assetName: string;
  quantity: number;
  price: string;
  rentalPrice: string;
  provider: string;
  categoryId: string;
  purchaseStatus: string;
  assetColor: string;
  assetMeasures: string;
  unavailableQuantity: number;
  unavailableReason: string;
  unavailableNote: string;
};

const input =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";

export default function EditForm({
  purchase,
  categories,
}: {
  purchase: EditablePurchase;
  categories: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [total, setTotal] = useState((purchase.quantity * Number(purchase.price)).toFixed(2));
  const [state, formAction, pending] = useActionState<PurchaseFormState, FormData>(updatePurchase, {});

  // Live preview only; the server recalculates the real total
  function updateTotal() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const qty = Number(fd.get("quantity")) || 0;
    const price = Number(fd.get("price")) || 0;
    setTotal((Math.round(qty * price * 100) / 100).toFixed(2));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const err = (name: string) =>
    state.fieldErrors?.[name] ? (
      <p className="mt-1 text-xs text-red-600">{state.fieldErrors[name]}</p>
    ) : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={updateTotal} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="purchaseId" value={purchase.id} />

      <label className="sm:col-span-2">
        <span className="text-sm">Item name</span>
        <input name="assetName" defaultValue={purchase.assetName} className={input} required maxLength={100} />
        {err("assetName")}
      </label>

      <label>
        <span className="text-sm">Quantity</span>
        <input name="quantity" type="number" min={1} step={1} defaultValue={purchase.quantity} className={input} required />
        {err("quantity")}
      </label>

      <label>
        <span className="text-sm">Unit price</span>
        <input name="price" inputMode="decimal" defaultValue={purchase.price} className={input} required />
        {err("price")}
      </label>

      <label>
        <span className="text-sm">Rental price (optional)</span>
        <input name="rentalPrice" inputMode="decimal" defaultValue={purchase.rentalPrice} placeholder="0.00" className={input} />
        <p className="mt-1 text-xs text-neutral-500">
          What a customer pays to rent one unit when it is not part of a set.
        </p>
        {err("rentalPrice")}
      </label>

      <label>
        <span className="text-sm">Provider</span>
        <input name="provider" defaultValue={purchase.provider} className={input} required maxLength={150} />
        {err("provider")}
      </label>

      <label>
        <span className="text-sm">Category</span>
        <select name="categoryId" defaultValue={purchase.categoryId} required className={input}>
          <option value="" disabled>
            Choose…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {err("categoryId")}
      </label>

      <label>
        <span className="text-sm">Status</span>
        <select name="purchaseStatus" defaultValue={purchase.purchaseStatus} className={input}>
          {PURCHASE_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {PURCHASE_STATUS_LABELS[v]}
            </option>
          ))}
        </select>
        {err("purchaseStatus")}
      </label>

      <label>
        <span className="text-sm">Color (optional)</span>
        <input name="assetColor" defaultValue={purchase.assetColor} className={input} maxLength={50} />
        {err("assetColor")}
      </label>

      <label>
        <span className="text-sm">Measures (optional)</span>
        <input name="assetMeasures" defaultValue={purchase.assetMeasures} className={input} maxLength={100} />
        {err("assetMeasures")}
      </label>

      <fieldset className="rounded-md border border-neutral-300 p-4 sm:col-span-2 dark:border-neutral-700">
        <legend className="px-1 text-sm font-medium">Out of service</legend>
        <p className="mb-3 text-xs text-neutral-500">
          Units in maintenance or retired are not counted as available for sets or events. Set 0 when all units
          are in service.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm">Units out of service</span>
            <input
              name="unavailableQuantity"
              type="number"
              min={0}
              step={1}
              defaultValue={purchase.unavailableQuantity}
              className={input}
            />
            {err("unavailableQuantity")}
          </label>

          <label>
            <span className="text-sm">Reason</span>
            <select name="unavailableReason" defaultValue={purchase.unavailableReason} className={input}>
              <option value="">—</option>
              {UNAVAILABLE_REASON_VALUES.map((v) => (
                <option key={v} value={v}>
                  {UNAVAILABLE_REASON_LABELS[v]}
                </option>
              ))}
            </select>
            {err("unavailableReason")}
          </label>

          <label className="sm:col-span-2">
            <span className="text-sm">Note (optional)</span>
            <input
              name="unavailableNote"
              defaultValue={purchase.unavailableNote}
              maxLength={255}
              placeholder="e.g. motor needs repair"
              className={input}
            />
            {err("unavailableNote")}
          </label>
        </div>
      </fieldset>

      <div className="flex items-center justify-between sm:col-span-2">
        <p className="text-sm">
          Total: <strong>${total}</strong>
        </p>
        <div className="flex items-center gap-3">
          <Link href="/purchases" className="text-sm hover:underline">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
    </form>
  );
}
