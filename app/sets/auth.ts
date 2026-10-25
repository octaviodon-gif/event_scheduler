"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { createSet, type SetFormState } from "./actions";

export type SlotItem = {
  id: string;
  name: string;
  provider: string;
  color: string | null;
  measures: string | null;
  usable: number; // units in service
};

export type SlotCategory = {
  id: string;
  name: string;
  owned: number; // usable units in the category (completed and in service)
  items: SlotItem[];
};

const input =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
const smallInput =
  "w-16 rounded-md border border-neutral-300 bg-transparent px-2 py-1 disabled:opacity-40 dark:border-neutral-700";

export default function SetForm({ categories }: { categories: SlotCategory[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const nextRow = useRef(1);
  const [fixedRows, setFixedRows] = useState<number[]>([]);

  async function submit(prev: SetFormState, fd: FormData) {
    const result = await createSet(prev, fd);
    if (result.ok) {
      formRef.current?.reset();
      setFixedRows([]);
    }
    return result;
  }

  const [state, formAction, pending] = useActionState(submit, {});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // manual submit so a validation error doesn't wipe the fields
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const err = (name: string) =>
    state.fieldErrors?.[name] ? (
      <p className="mt-1 text-xs text-red-600">{state.fieldErrors[name]}</p>
    ) : null;

  const categoriesWithItems = categories.filter((c) => c.items.length > 0);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="text-sm">Set name</span>
        <input name="assetName" className={input} required maxLength={100} />
        {err("assetName")}
      </label>

      <label>
        <span className="text-sm">Fixed price per event</span>
        <input name="assetPrice" inputMode="decimal" placeholder="0.00" className={input} required />
        {err("assetPrice")}
      </label>

      <label>
        <span className="text-sm">Max rented at the same time (optional)</span>
        <input name="assetAmount" inputMode="numeric" placeholder="No limit" className={input} />
        {err("assetAmount")}
      </label>

      <label>
        <span className="text-sm">Color (optional)</span>
        <input name="assetColor" className={input} maxLength={50} />
        {err("assetColor")}
      </label>

      <label>
        <span className="text-sm">Measures (optional)</span>
        <input name="assetMeasures" className={input} maxLength={100} />
        {err("assetMeasures")}
      </label>

      {/* ---------- Always included: pick specific items ---------- */}
      <div className="sm:col-span-2">
        <p className="text-sm font-medium">Always included (specific items)</p>
        <p className="text-xs text-neutral-500">
          Choose the exact item from your inventory, for example one particular baby-gym. It is part of this set
          every time it is rented.
        </p>

        {categoriesWithItems.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
            No usable items yet. Register purchases with a category and mark them as completed first.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {fixedRows.map((rowId) => (
              <div key={rowId} className="flex flex-wrap items-center gap-2">
                <select name="fixedItem" defaultValue="" className={`${input} min-w-0 flex-1`}>
                  <option value="">Choose an item…</option>
                  {categoriesWithItems.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      {c.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                          {it.color ? ` · ${it.color}` : ""}
                          {it.measures ? ` · ${it.measures}` : ""} ({it.usable} usable)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  Qty
                  <input
                    name="fixedQty"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={1}
                    className={smallInput}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setFixedRows((rows) => rows.filter((r) => r !== rowId))}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setFixedRows((rows) => [...rows, nextRow.current++])}
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              + Add a specific item
            </button>
          </div>
        )}
      </div>

      {/* ---------- Customer picks: how many per category ---------- */}
      <div className="sm:col-span-2">
        <p className="text-sm font-medium">Customer picks (chosen when you book the event)</p>
        <p className="text-xs text-neutral-500">
          For each category, enter how many items are chosen at booking time from whatever is free that day.
          Leave 0 to skip a category.
        </p>

        {categories.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
            No categories yet. Create them in Item categories first.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-300 dark:divide-neutral-800 dark:border-neutral-700">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-3">
                <div className="text-sm">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-neutral-500">{c.owned} usable item(s)</p>
                </div>
                <input
                  name={`slot_${c.id}`}
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  disabled={c.owned === 0}
                  aria-label={`How many ${c.name} the customer picks`}
                  className={smallInput}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Saving…" : "Save set"}
        </button>
      </div>

      {state.ok && <p className="text-sm text-green-700 sm:col-span-2">Set saved.</p>}
      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
    </form>
  );
}
