"use client";

import { useState, useTransition } from "react";
import { deleteSet } from "./actions";

export default function DeleteSetButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm(`Delete the set "${name}"? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteSet(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
