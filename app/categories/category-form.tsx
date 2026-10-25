"use client";

import { startTransition, useActionState, useRef } from "react";
import { createCategory, type CategoryFormState } from "./actions";

export default function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(prev: CategoryFormState, fd: FormData) {
    const result = await createCategory(prev, fd);
    if (result.ok) formRef.current?.reset();
    return result;
  }

  const [state, formAction, pending] = useActionState(submit, {});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="grow">
        <span className="text-sm">New category</span>
        <input
          name="name"
          required
          maxLength={50}
          placeholder="e.g. Inflable, Toldo, Montaña rusa, Pelotas"
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Add"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
