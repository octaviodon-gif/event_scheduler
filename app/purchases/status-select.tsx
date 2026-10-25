"use client";

import { useState, useTransition } from "react";
import { updatePurchaseStatus } from "./actions";
import {
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_VALUES,
  type PurchaseStatusValue,
} from "@/lib/purchase-status";

export default function StatusSelect({ id, value }: { id: string; value: PurchaseStatusValue }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const el = e.currentTarget;
    const next = el.value;
    setError(null);
    start(async () => {
      const result = await updatePurchaseStatus(id, next);
      if (result.error) {
        el.value = value; // put the dropdown back to the saved status
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <select
        defaultValue={value}
        disabled={pending}
        onChange={onChange}
        className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
      >
        {PURCHASE_STATUS_VALUES.map((v) => (
          <option key={v} value={v}>
            {PURCHASE_STATUS_LABELS[v]}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
