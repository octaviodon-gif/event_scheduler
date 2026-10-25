"use client";

import { startTransition, useActionState, useRef } from "react";
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

  async function submit(prev: SetFormState, fd: FormData) {
    const result = await createSet(prev, fd);
    if (result.ok) formRef.current?.reset();
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

      <div className="sm:col-span-2">
        <p className="text-sm font-medium">What is in the set (no extra cost)</p>
        <p className="text-xs text-neutral-500">
          For each category you can do two things. <strong>Always included</strong>: enter a number next to a
          specific item and it is part of the set every time. <strong>Customer picks</strong>: enter how many
          items of the category are chosen when you book an event, from whatever is free that day. Leave 0 to
          skip.
        </p>

        {categories.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
            No categories yet. Create them in Item categories, register your purchases and mark them as completed.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-300 dark:divide-neutral-800 dark:border-neutral-700">
            {categories.map((c) => (
              <li key={c.id} className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-neutral-500">{c.owned} usable item(s)</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    Customer picks
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
                  </label>
                </div>

                {c.items.length > 0 && (
                  <ul className="mt-3 space-y-2 border-l border-neutral-200 pl-3 dark:border-neutral-800">
                    {c.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-4 text-sm">
                        <div>
                          <p>{it.name}</p>
                          <p className="text-xs text-neutral-500">
                            {it.provider}
                            {it.color ? ` · ${it.color}` : ""}
                            {it.measures ? ` · ${it.measures}` : ""} · {it.usable} usable
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-neutral-500">
                          Always included
                          <input
                            name={`fixed_${it.id}`}
                            type="number"
                            min={0}
                            max={it.usable}
                            step={1}
                            defaultValue={0}
                            aria-label={`Units of ${it.name} always in the set`}
                            className={smallInput}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
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
