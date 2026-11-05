"use client";

import { useState } from "react";
import { createCategoryInline } from "./actions";

const input =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";

const NEW = "__new__";

// A category dropdown that also lets you create a new category on the spot.
// The real value is sent in a hidden field named `name` (the dropdown itself is not submitted).
export default function CategorySelect({
  name = "categoryId",
  categories,
  defaultValue = "",
}: {
  name?: string;
  categories: { id: string; name: string }[];
  defaultValue?: string;
}) {
  const [list, setList] = useState(categories);
  const [value, setValue] = useState(defaultValue);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    setError(null);
    const result = await createCategoryInline(newName);
    setSaving(false);
    if (result.error || !result.id || !result.name) {
      setError(result.error ?? "Could not create the category.");
      return;
    }
    const created = { id: result.id, name: result.name };
    setList((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
    setValue(created.id);
    setAdding(false);
    setNewName("");
  }

  return (
    <div>
      <select
        value={adding ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setAdding(true);
            setError(null);
          } else {
            setAdding(false);
            setValue(e.target.value);
          }
        }}
        className={input}
        required={!adding}
      >
        <option value="" disabled>
          Choose…
        </option>
        {[...list]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        <option value={NEW}>＋ Create new category…</option>
      </select>
      <input type="hidden" name={name} value={adding ? "" : value} />

      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // Enter must not submit the whole form
                if (newName.trim() && !saving) void create();
              }
            }}
            placeholder="New category name, e.g. Inflable"
            maxLength={50}
            autoFocus
            className={`${input} min-w-0 flex-1`}
          />
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={() => void create()}
            className="rounded-md bg-brand px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError(null);
            }}
            className="text-sm hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
