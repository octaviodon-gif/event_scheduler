"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CalendarRetryButton from "./[eventNo]/calendar-retry";

export type EventRow = {
  eventNo: number;
  label: string; // e.g. BBCITOS-0012
  date: string; // YYYY-MM-DD
  time: string; // "10:00 – 15:00 (+1)"
  endHM: string; // "15:00"
  nextDay: boolean; // the event ends the day after its date
  customer: string;
  sets: string;
  total: number;
  pending: number;
  invited: boolean;
};

const money = (n: number) => `$${n.toFixed(2)}`;

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

type Filter = "all" | "scheduled" | "completed";

// An event is completed once its end time has passed
function isCompleted(ev: EventRow, now: Date) {
  const [y, m, d] = ev.date.split("-").map(Number);
  const [hh, mm] = ev.endHM.split(":").map(Number);
  const end = new Date(y, m - 1, d + (ev.nextDay ? 1 : 0), hh, mm);
  return end.getTime() <= now.getTime();
}

// Same column layout for the header and every row, so they always line up
const COLS =
  "md:grid md:grid-cols-[0.9fr_1.1fr_1.1fr_minmax(0,2fr)_0.9fr_0.9fr_1fr] md:items-center md:gap-3";

function Row({ ev }: { ev: EventRow }) {
  return (
    <li className={`px-4 py-3 ${COLS}`}>
      <div>
        <Link
          href={`/events/${ev.eventNo}`}
          className="inline-block rounded-lg border border-violet-200 px-3 py-1 text-sm font-medium text-brand hover:bg-violet-50"
        >
          {ev.label}
        </Link>
      </div>

      <div className="mt-2 text-sm md:mt-0">{dayLabel(ev.date)}</div>
      <div className="text-sm text-neutral-600 md:text-neutral-900">{ev.time}</div>

      <div className="mt-2 min-w-0 md:mt-0">
        <p className="font-medium">{ev.customer}</p>
        <p className="text-xs text-neutral-500">{ev.sets || "—"}</p>
      </div>

      <div className="mt-2 flex justify-between text-sm md:mt-0 md:block md:text-right">
        <span className="text-xs text-neutral-500 md:hidden">Total</span>
        {money(ev.total)}
      </div>
      <div
        className={`flex justify-between text-sm md:block md:text-right ${
          ev.pending > 0 ? "text-neutral-900" : "text-neutral-500"
        }`}
      >
        <span className="text-xs font-normal text-neutral-500 md:hidden">Balance</span>
        {money(ev.pending)}
      </div>

      <div className="mt-2 text-sm md:mt-0 md:text-right">
        {ev.invited ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Invite sent</span>
        ) : (
          <CalendarRetryButton eventNo={ev.eventNo} compact />
        )}
      </div>
    </li>
  );
}

function Header() {
  return (
    <div
      className={`hidden border-b border-violet-100 bg-violet-50/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500 ${COLS}`}
    >
      <span>No.</span>
      <span>Date</span>
      <span>Time</span>
      <span>Customer / Set</span>
      <span className="text-right">Total</span>
      <span className="text-right">Balance</span>
      <span className="text-right">Calendar</span>
    </div>
  );
}

export default function EventList({ rows }: { rows: EventRow[] }) {
  const [month, setMonth] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const months = useMemo(
    () => [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return rows.filter((r) => {
      if (month !== "all" && r.date.slice(0, 7) !== month) return false;
      if (filter === "scheduled" && isCompleted(r, now)) return false;
      if (filter === "completed" && !isCompleted(r, now)) return false;
      if (q && ![r.customer, r.sets, r.label].some((s) => s.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, month, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const r of filtered) {
      const key = r.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // Balance still to collect on the day of the event (only meaningful for upcoming events)
  const pendingTotal =
    filter === "scheduled" ? filtered.reduce((s, r) => s + r.pending, 0) : 0;
  const card = "overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm";
  const chip = (on: boolean) =>
    `px-3 py-2 ${on ? "bg-brand text-white" : "text-neutral-600 hover:bg-violet-50"}`;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, set or number…"
          className="min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
        />
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
          aria-label="Month"
        >
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <div className="inline-flex overflow-hidden rounded-lg border border-violet-200 bg-white text-sm">
          <button type="button" onClick={() => setFilter("all")} className={chip(filter === "all")}>
            All
          </button>
          <button type="button" onClick={() => setFilter("scheduled")} className={chip(filter === "scheduled")}>
            Scheduled
          </button>
          <button type="button" onClick={() => setFilter("completed")} className={chip(filter === "completed")}>
            Completed
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-neutral-500">
        {filtered.length} {filtered.length === 1 ? "event" : "events"}
        {pendingTotal > 0 && <> · {money(pendingTotal)} balance to collect</>}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No events match these filters.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(([key, items]) => (
            <section key={key} className={card}>
              <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                <h3 className="font-display text-base font-semibold text-brand">{monthLabel(key)}</h3>
                <p className="text-xs text-neutral-500">
                  {items.length} {items.length === 1 ? "event" : "events"} ·{" "}
                  {money(items.reduce((s, i) => s + i.total, 0))}
                </p>
              </div>
              <Header />
              <ul className="divide-y divide-violet-100 border-t border-violet-100 md:border-t-0">
                {items.map((ev) => (
                  <Row key={ev.eventNo} ev={ev} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
