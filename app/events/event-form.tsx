"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { createEvent, getFreeUnits, updateEvent, type EventFormState } from "./actions";
import { addMinutes } from "@/lib/time";

export type CatalogItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  color: string | null;
  measures: string | null;
  rentalPrice: string | null; // null = cannot be rented as an extra
};

export type CatalogSet = {
  id: string;
  name: string;
  price: string;
  fixed: { purchaseId: string; name: string; quantity: number }[];
  slots: { categoryId: string; categoryName: string; quantity: number }[];
};

// Values of an existing event, when editing it
export type EventInitial = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  eventAddress: string;
  notes: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  setId: string; // "" = no set
  setPrice: string | null; // set price when it was booked
  picks: string[]; // purchase ids chosen for the set's rows (repeated when more than one unit)
  extras: { item: string; qty: number; unitPrice: string | null }[]; // unitPrice = price when it was booked
  discount: string;
  down: string;
};

type ExtraRow = { key: number; item: string; qty: number };
type Skip = { cat: string; idx: number } | { extra: number };

const input =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
const smallInput =
  "w-20 rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700";
const readonlyInput =
  "w-full rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const fmt = (n: number) => n.toFixed(2);

// 24-hour time picker: two lists to scroll (hours 00-23, minutes in steps of 5)
function TimeSelect24({
  value,
  onChange,
  maxStartMinutes,
}: {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
  maxStartMinutes: number; // latest start that still ends before midnight
}) {
  const [hh, mm] = value ? value.split(":") : ["", ""];
  const maxHour = Math.floor(maxStartMinutes / 60);
  const hours = Array.from({ length: maxHour + 1 }, (_, h) => String(h).padStart(2, "0"));
  const allMinutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const minutes = hh
    ? allMinutes.filter((m) => Number(hh) * 60 + Number(m) <= maxStartMinutes)
    : allMinutes;

  function onHourChange(h: string) {
    if (!h) return onChange("");
    const keep = mm && Number(h) * 60 + Number(mm) <= maxStartMinutes ? mm : "00";
    onChange(`${h}:${keep}`);
  }

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Hour (24 h)"
        value={hh}
        onChange={(e) => onHourChange(e.target.value)}
        className={input}
        required
      >
        <option value="">HH</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        aria-label="Minutes"
        value={mm}
        disabled={!hh}
        onChange={(e) => onChange(`${hh}:${e.target.value}`)}
        className={`${input} disabled:opacity-50`}
      >
        {!hh && <option value="">MM</option>}
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function EventForm({
  nextNo,
  sets,
  items,
  durationMinutes,
  edit,
}: {
  nextNo: string;
  sets: CatalogSet[];
  items: CatalogItem[];
  durationMinutes: number; // every event lasts this long
  edit?: { eventNo: number; initial: EventInitial; initialFree: Record<string, number> };
}) {
  const initial = edit?.initial;
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    edit ? updateEvent : createEvent,
    {},
  );

  const itemById = new Map(items.map((i) => [i.id, i]));

  // when
  const [date, setDate] = useState(initial?.date ?? "");
  const [start, setStart] = useState(initial?.start ?? "");
  const [free, setFree] = useState<Record<string, number> | null>(edit?.initialFree ?? null);
  const [loading, setLoading] = useState(false);
  const [whenError, setWhenError] = useState<string | null>(null);
  const requestId = useRef(0);
  const end = start ? addMinutes(start, durationMinutes) : null; // start + duration
  const maxStart = 24 * 60 - 1 - durationMinutes; // latest start that still ends before midnight

  // what
  const [setId, setSetId] = useState(initial?.setId ?? "");
  const [picks, setPicks] = useState<Record<string, string[]>>(() => {
    const set = sets.find((s) => s.id === initial?.setId);
    if (!initial || !set) return {};
    const left = [...initial.picks];
    const out: Record<string, string[]> = {};
    for (const slot of set.slots) {
      const arr: string[] = [];
      for (let i = 0; i < slot.quantity; i++) {
        const at = left.findIndex((id) => itemById.get(id)?.categoryId === slot.categoryId);
        arr.push(at >= 0 ? left.splice(at, 1)[0] : "");
      }
      out[slot.categoryId] = arr;
    }
    return out;
  });
  const [extras, setExtras] = useState<ExtraRow[]>(() =>
    (initial?.extras ?? []).map((e, i) => ({ key: i + 1, item: e.item, qty: e.qty })),
  );
  const nextKey = useRef((initial?.extras.length ?? 0) + 1);

  // money
  const [discount, setDiscount] = useState(initial?.discount ?? "");
  const [down, setDown] = useState(initial?.down ?? "");

  const selectedSet = sets.find((s) => s.id === setId) ?? null;

  // Prices an edited event already had are kept, so later price changes do not alter it
  const keptExtraPrices = new Map(
    (initial?.extras ?? []).filter((e) => e.unitPrice).map((e) => [e.item, e.unitPrice as string]),
  );
  const setPriceOf = (s: CatalogSet) =>
    initial?.setPrice && s.id === initial.setId ? initial.setPrice : s.price;
  const extraPriceOf = (id: string): string | null =>
    keptExtraPrices.get(id) ?? itemById.get(id)?.rentalPrice ?? null;

  // ── availability ─────────────────────────────
  // The choices stay; if something chosen is not free at the new time, a warning appears.
  function onWhenChange(nextDate: string, nextStart: string) {
    setDate(nextDate);
    setStart(nextStart);
    setFree(null);
    setWhenError(null);

    if (!DATE_RE.test(nextDate) || !TIME_RE.test(nextStart)) return;
    if (!addMinutes(nextStart, durationMinutes)) {
      setWhenError("That start time would end after midnight. Choose an earlier start.");
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    startTransition(async () => {
      const result = await getFreeUnits(nextDate, nextStart, edit?.eventNo);
      if (id !== requestId.current) return; // an older answer arrived late
      setLoading(false);
      if (result.error) setWhenError(result.error);
      else setFree(result.free ?? {});
    });
  }

  // Units of an item still free after everything already chosen in this form
  function remaining(itemId: string, skip?: Skip): number {
    let left = free?.[itemId] ?? 0;
    if (selectedSet) {
      for (const f of selectedSet.fixed) if (f.purchaseId === itemId) left -= f.quantity;
    }
    for (const [cat, arr] of Object.entries(picks)) {
      arr.forEach((value, idx) => {
        if (value !== itemId) return;
        if (skip && "cat" in skip && skip.cat === cat && skip.idx === idx) return;
        left -= 1;
      });
    }
    for (const row of extras) {
      if (row.item !== itemId) continue;
      if (skip && "extra" in skip && skip.extra === row.key) continue;
      left -= row.qty || 0;
    }
    return left;
  }

  // Items chosen that are not free (enough) at the current date and time
  const conflicts: string[] = (() => {
    if (!free) return [];
    const totals = new Map<string, number>();
    const add = (id: string, n: number) => {
      if (id) totals.set(id, (totals.get(id) ?? 0) + n);
    };
    selectedSet?.fixed.forEach((f) => add(f.purchaseId, f.quantity));
    Object.values(picks).forEach((arr) => arr.forEach((v) => add(v, 1)));
    extras.forEach((r) => add(r.item, r.qty || 0));

    const names = new Map(items.map((i) => [i.id, i.name]));
    selectedSet?.fixed.forEach((f) => names.set(f.purchaseId, f.name));
    return [...totals]
      .filter(([id, n]) => n > (free[id] ?? 0))
      .map(([id]) => names.get(id) ?? "an item");
  })();

  function setIsAvailable(set: CatalogSet) {
    if (!free) return false;
    for (const f of set.fixed) {
      if ((free[f.purchaseId] ?? 0) < f.quantity) return false;
    }
    for (const slot of set.slots) {
      const fixedHere = set.fixed
        .filter((f) => itemById.get(f.purchaseId)?.categoryId === slot.categoryId)
        .reduce((sum, f) => sum + f.quantity, 0);
      const poolFree = items
        .filter((i) => i.categoryId === slot.categoryId)
        .reduce((sum, i) => sum + (free[i.id] ?? 0), 0);
      if (poolFree - fixedHere < slot.quantity) return false;
    }
    return true;
  }

  function onSetChange(id: string) {
    setSetId(id);
    const set = sets.find((s) => s.id === id);
    const next: Record<string, string[]> = {};
    for (const slot of set?.slots ?? []) {
      next[slot.categoryId] = Array.from({ length: slot.quantity }, () => "");
    }
    setPicks(next);
  }

  function setPick(cat: string, idx: number, value: string, length: number) {
    setPicks((prev) => {
      const arr = [...(prev[cat] ?? Array.from({ length }, () => ""))];
      arr[idx] = value;
      return { ...prev, [cat]: arr };
    });
  }

  // ── money preview (the server recalculates everything) ─────────────
  const setPrice = selectedSet ? Number(setPriceOf(selectedSet)) : 0;
  const extrasTotal = extras.reduce((sum, row) => {
    const p = extraPriceOf(row.item);
    return sum + (p ? Number(p) * (row.qty || 0) : 0);
  }, 0);
  const subtotal = setPrice + extrasTotal;
  const discountN = Number(discount) || 0;
  const total = Math.max(subtotal - discountN, 0);
  const downN = Number(down) || 0;
  const pendingN = Math.max(total - downN, 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // manual submit so an error doesn't wipe what was typed
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  const err = (name: string) =>
    state.fieldErrors?.[name] ? (
      <p className="mt-1 text-xs text-red-600">{state.fieldErrors[name]}</p>
    ) : null;

  const ready = !!free;
  const optionLabel = (it: CatalogItem, extra?: string) =>
    `${it.name}${it.color ? ` · ${it.color}` : ""}${it.measures ? ` · ${it.measures}` : ""}${extra ?? ""}`;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {edit && <input type="hidden" name="eventNo" value={edit.eventNo} />}

      {/* ───────── event number ───────── */}
      <label>
        <span className="text-sm">Event no.</span>
        <input value={nextNo} readOnly className={readonlyInput} />
        {!edit && <p className="mt-1 text-xs text-neutral-500">Assigned when you schedule the event.</p>}
      </label>
      <div />

      {/* ───────── customer ───────── */}
      <label>
        <span className="text-sm">Customer name</span>
        <input name="customerName" defaultValue={initial?.customerName} className={input} required maxLength={150} />
        {err("customerName")}
      </label>

      <label>
        <span className="text-sm">Customer phone</span>
        <input
          name="customerPhone"
          type="tel"
          defaultValue={initial?.customerPhone}
          className={input}
          required
          maxLength={20}
        />
        {err("customerPhone")}
      </label>

      <label className="sm:col-span-2">
        <span className="text-sm">Customer email</span>
        <input
          name="customerEmail"
          type="email"
          defaultValue={initial?.customerEmail}
          className={input}
          maxLength={255}
        />
        <p className="mt-1 text-xs text-neutral-500">
          The customer receives the Google Calendar invite at this address. Leave it empty to add the event only
          to your calendar.
          {edit ? " Saving your changes sends the customer the updated invite." : ""}
        </p>
        {err("customerEmail")}
      </label>

      <label className="sm:col-span-2">
        <span className="text-sm">Event address</span>
        <textarea
          name="eventAddress"
          rows={2}
          defaultValue={initial?.eventAddress}
          className={input}
          required
          maxLength={500}
          placeholder="Paste the address from Google Maps"
        />
        {err("eventAddress")}
      </label>

      <label className="sm:col-span-2">
        <span className="text-sm">Notes (optional)</span>
        <textarea name="notes" rows={2} defaultValue={initial?.notes} className={input} maxLength={1000} />
        {err("notes")}
      </label>

      {/* ───────── date and time ───────── */}
      <label>
        <span className="text-sm">Date</span>
        <input
          name="date"
          type="date"
          value={date}
          onChange={(e) => onWhenChange(e.target.value, start)}
          onClick={(e) => {
            // clicking anywhere in the field opens the calendar
            try {
              e.currentTarget.showPicker();
            } catch {
              /* some browsers only open it from the icon */
            }
          }}
          className={`${input} cursor-pointer [color-scheme:light] dark:[color-scheme:dark]`}
          required
        />
        {err("date")}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-sm">Start (24 h)</span>
          <TimeSelect24 value={start} onChange={(v) => onWhenChange(date, v)} maxStartMinutes={maxStart} />
          <input type="hidden" name="startTime" value={start} />
          {err("startTime")}
        </div>
        <label>
          <span className="text-sm">End (automatic)</span>
          <input value={end ?? ""} readOnly placeholder="—" className={readonlyInput} />
        </label>
      </div>

      <p className="text-xs text-neutral-500 sm:col-span-2">
        {loading
          ? "Checking what is free at that time…"
          : ready
            ? `Only items that are free at that date and time are offered below. Every event lasts ${durationMinutes / 60} hours.`
            : `Choose the date and the start time to see what is available. Every event lasts ${durationMinutes / 60} hours.`}
      </p>
      {whenError && <p className="text-sm text-red-600 sm:col-span-2">{whenError}</p>}

      {/* ───────── set ───────── */}
      <div className="sm:col-span-2">
        <label className="block">
          <span className="text-sm font-medium">Set</span>
          <select
            name="assetId"
            value={setId}
            onChange={(e) => onSetChange(e.target.value)}
            disabled={!ready}
            className={`${input} disabled:opacity-50`}
          >
            <option value="">No set (extra items only)</option>
            {sets.map((s) => {
              const ok = setIsAvailable(s);
              return (
                <option key={s.id} value={s.id} disabled={!ok && s.id !== setId}>
                  {s.name} — ${setPriceOf(s)}
                  {ok ? "" : " (not available at that time)"}
                </option>
              );
            })}
          </select>
          {err("assetId")}
        </label>
        {edit && (
          <p className="mt-1 text-xs text-neutral-500">Choosing a different set clears the items picked for it.</p>
        )}

        {selectedSet && (
          <div className="mt-3 space-y-3 rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
            {selectedSet.fixed.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Always included</p>
                <ul className="mt-1 text-sm">
                  {selectedSet.fixed.map((f) => (
                    <li key={f.purchaseId}>
                      {f.quantity} × {f.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedSet.slots.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Choose the items (no extra cost)
                </p>
                {selectedSet.slots.flatMap((slot) =>
                  Array.from({ length: slot.quantity }, (_, idx) => {
                    const current = picks[slot.categoryId]?.[idx] ?? "";
                    const options = items.filter(
                      (i) =>
                        i.categoryId === slot.categoryId &&
                        (i.id === current || remaining(i.id, { cat: slot.categoryId, idx }) >= 1),
                    );
                    return (
                      <label key={`${slot.categoryId}-${idx}`} className="block">
                        <span className="text-xs text-neutral-500">
                          {slot.categoryName} #{idx + 1}
                        </span>
                        <select
                          value={current}
                          onChange={(e) => setPick(slot.categoryId, idx, e.target.value, slot.quantity)}
                          className={input}
                          required
                        >
                          <option value="">Choose…</option>
                          {options.map((it) => (
                            <option key={it.id} value={it.id}>
                              {optionLabel(it)}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }),
                )}
              </div>
            )}
          </div>
        )}

        {Object.values(picks)
          .flat()
          .filter(Boolean)
          .map((value, i) => (
            <input key={`${value}-${i}`} type="hidden" name="pick" value={value} />
          ))}
      </div>

      {/* ───────── extra items ───────── */}
      <div className="sm:col-span-2">
        <p className="text-sm font-medium">Extra items for rent</p>
        <p className="text-xs text-neutral-500">
          Items that are not part of the set. Each one is charged at its rental price. Only items with a rental
          price are listed.
        </p>

        <div className="mt-3 space-y-2">
          {extras.map((row) => {
            const it = itemById.get(row.item);
            const left = it ? remaining(it.id, { extra: row.key }) : 0;
            const options = items.filter(
              (i) =>
                (i.rentalPrice !== null || keptExtraPrices.has(i.id)) &&
                (i.id === row.item || remaining(i.id, { extra: row.key }) >= 1),
            );
            const price = extraPriceOf(row.item);
            return (
              <div key={row.key} className="flex flex-wrap items-center gap-2">
                <select
                  name="extraItem"
                  value={row.item}
                  onChange={(e) =>
                    setExtras((rows) =>
                      rows.map((r) => (r.key === row.key ? { ...r, item: e.target.value, qty: 1 } : r)),
                    )
                  }
                  className={`${input} min-w-0 flex-1`}
                  required
                >
                  <option value="">Choose an item…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {optionLabel(o, ` — $${extraPriceOf(o.id)}`)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  Qty
                  <input
                    name="extraQty"
                    type="number"
                    min={1}
                    max={Math.max(left, 1)}
                    step={1}
                    value={row.qty}
                    onChange={(e) =>
                      setExtras((rows) =>
                        rows.map((r) => (r.key === row.key ? { ...r, qty: Number(e.target.value) } : r)),
                      )
                    }
                    className={smallInput}
                  />
                </label>
                <span className="w-24 text-right text-sm">
                  {price ? `$${fmt(Number(price) * (row.qty || 0))}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setExtras((rows) => rows.filter((r) => r.key !== row.key))}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={!ready}
            onClick={() => setExtras((rows) => [...rows, { key: nextKey.current++, item: "", qty: 1 }])}
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            + Add an extra item
          </button>
        </div>
      </div>

      {/* ───────── payment ───────── */}
      <div className="grid gap-4 rounded-md border border-neutral-300 p-4 sm:col-span-2 sm:grid-cols-2 dark:border-neutral-700">
        <p className="text-sm font-medium sm:col-span-2">Payment</p>

        <label>
          <span className="text-sm">Discount (optional)</span>
          <input
            name="discount"
            inputMode="decimal"
            placeholder="0.00"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className={input}
          />
          {err("discount")}
        </label>

        <label>
          <span className="text-sm">Rent total</span>
          <input value={`$${fmt(total)}`} readOnly className={readonlyInput} />
          <p className="mt-1 text-xs text-neutral-500">
            Set ${fmt(setPrice)} + extras ${fmt(extrasTotal)} − discount ${fmt(discountN)}
          </p>
        </label>

        <label>
          <span className="text-sm">Down payment</span>
          <input
            name="downPaymentAmount"
            inputMode="decimal"
            placeholder="0.00"
            value={down}
            onChange={(e) => setDown(e.target.value)}
            className={input}
            required
          />
          {err("downPaymentAmount")}
        </label>

        <label>
          <span className="text-sm">Pending payment</span>
          <input value={`$${fmt(pendingN)}`} readOnly className={readonlyInput} />
          <p className="mt-1 text-xs text-neutral-500">
            Paid in full: {total > 0 && pendingN === 0 ? "yes" : "no"}
          </p>
        </label>

        {!edit && (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="downPaymentReceived" required className="mt-1" />
            <span>The down payment has been paid. An event is never scheduled until it is.</span>
          </label>
        )}
      </div>

      {conflicts.length > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          Not enough free units at that date and time for: {conflicts.join(", ")}. Change those items to continue.
        </p>
      )}

      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        <Link href={edit ? `/events/${edit.eventNo}` : "/events"} className="text-sm hover:underline">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || !ready || conflicts.length > 0}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? (edit ? "Saving…" : "Scheduling…") : edit ? "Save changes" : "Schedule event"}
        </button>
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
    </form>
  );
}
