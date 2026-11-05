"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StatusSelect from "./status-select";
import {
  UNAVAILABLE_REASON_LABELS,
  type PurchaseStatusValue,
  type UnavailableReasonValue,
} from "@/lib/purchase-status";

export type PurchaseRow = {
  id: string;
  name: string;
  category: string | null;
  provider: string;
  quantity: number;
  unavailableQuantity: number;
  unavailableReason: string | null;
  status: string;
  price: number;
  rentalPrice: number | null;
  total: number;
};

const money = (n: number) => `$${n.toFixed(2)}`;

// Same column layout for the header and every row, so they always line up
const COLS = "md:grid md:grid-cols-[minmax(0,2.2fr)_0.9fr_1.4fr_0.9fr_0.9fr_0.9fr_auto] md:items-center md:gap-3";

function Row({ p, showCategory }: { p: PurchaseRow; showCategory: boolean }) {
  const inService = p.quantity - p.unavailableQuantity;
  return (
    <li className={`px-4 py-3 ${COLS}`}>
      <div className="min-w-0">
        <p className="font-medium">{p.name}</p>
        <p className="text-xs text-neutral-500">
          {showCategory && p.category ? `${p.category} · ` : ""}
          {p.provider}
        </p>
      </div>

      <div className="mt-2 text-sm md:mt-0">
        <span className="text-xs text-neutral-500 md:hidden">In service: </span>
        {inService} of {p.quantity}
        {p.unavailableQuantity > 0 && p.unavailableReason && (
          <p className="text-xs text-amber-700">
            {p.unavailableQuantity}{" "}
            {UNAVAILABLE_REASON_LABELS[p.unavailableReason as UnavailableReasonValue].toLowerCase()}
          </p>
        )}
      </div>

      <div className="mt-2 md:mt-0">
        <StatusSelect id={p.id} value={p.status as PurchaseStatusValue} />
      </div>

      <div className="mt-2 flex justify-between text-sm md:mt-0 md:block md:text-right">
        <span className="text-xs text-neutral-500 md:hidden">Unit price</span>
        {money(p.price)}
      </div>
      <div className="flex justify-between text-sm md:block md:text-right">
        <span className="text-xs text-neutral-500 md:hidden">Rental price</span>
        {p.rentalPrice ? money(p.rentalPrice) : "—"}
      </div>
      <div className="flex justify-between text-sm font-medium md:block md:text-right">
        <span className="text-xs font-normal text-neutral-500 md:hidden">Total</span>
        {money(p.total)}
      </div>

      <div className="mt-2 md:mt-0 md:text-right">
        <Link
          href={`/purchases/${p.id}/edit`}
          className="inline-block rounded-lg border border-violet-200 px-3 py-1 text-sm text-brand hover:bg-violet-50"
        >
          Edit
        </Link>
      </div>
    </li>
  );
}

function Header() {
  return (
    <div
      className={`hidden border-b border-violet-100 bg-violet-50/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500 ${COLS}`}
    >
      <span>Item</span>
      <span>In service</span>
      <span>Status</span>
      <span className="text-right">Unit price</span>
      <span className="text-right">Rental</span>
      <span className="text-right">Total</span>
      <span className="w-12" />
    </div>
  );
}

export default function PurchaseList({ rows }: { rows: PurchaseRow[] }) {
  const [grouped, setGrouped] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter((r) =>
          [r.name, r.category ?? "", r.provider].some((s) => s.toLowerCase().includes(q)),
        )
      : rows;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, query]);

  const groups = useMemo(() => {
    const map = new Map<string, PurchaseRow[]>();
    for (const r of filtered) {
      const key = r.category ?? "No category";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    // alphabetical, with "No category" last
    return [...map.entries()].sort(([a], [b]) =>
      a === "No category" ? 1 : b === "No category" ? -1 : a.localeCompare(b),
    );
  }, [filtered]);

  const card = "overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm";

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item, category or provider…"
          className="min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
        />
        <div className="inline-flex overflow-hidden rounded-lg border border-violet-200 bg-white text-sm">
          <button
            type="button"
            onClick={() => setGrouped(true)}
            className={`px-3 py-2 ${grouped ? "bg-brand text-white" : "text-neutral-600 hover:bg-violet-50"}`}
          >
            By category
          </button>
          <button
            type="button"
            onClick={() => setGrouped(false)}
            className={`px-3 py-2 ${!grouped ? "bg-brand text-white" : "text-neutral-600 hover:bg-violet-50"}`}
          >
            All items
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No purchases match your search.</p>
      ) : grouped ? (
        <div className="mt-4 space-y-5">
          {groups.map(([name, items]) => (
            <section key={name} className={card}>
              <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                <h3 className="font-display text-base font-semibold text-brand">{name}</h3>
                <p className="text-xs text-neutral-500">
                  {items.length} {items.length === 1 ? "item" : "items"} ·{" "}
                  {money(items.reduce((s, i) => s + i.total, 0))}
                </p>
              </div>
              <Header />
              <ul className="divide-y divide-violet-100 border-t border-violet-100 md:border-t-0">
                {items.map((p) => (
                  <Row key={p.id} p={p} showCategory={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <section className={`mt-4 ${card}`}>
          <Header />
          <ul className="divide-y divide-violet-100">
            {filtered.map((p) => (
              <Row key={p.id} p={p} showCategory />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
