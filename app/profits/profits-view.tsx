"use client";

import { useMemo, useState } from "react";

export type ProfitEvent = {
  eventNo: number;
  date: string; // YYYY-MM-DD
  total: number; // rent total after discount
  discount: number;
  sets: { name: string; quantity: number; price: number }[];
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const compact = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : `$${Math.round(n)}`;

type Bucket = { key: string; month: string; label: string; earned: number; booked: number };

function nextMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function Kpi({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-brand">{value}</p>
      {note && <p className="mt-1 text-xs text-neutral-500">{note}</p>}
    </div>
  );
}

export default function ProfitsView({ rows, today }: { rows: ProfitEvent[]; today: string }) {
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");

  const years = useMemo(
    () => [...new Set(rows.map((r) => r.date.slice(0, 4)))].sort().reverse(),
    [rows],
  );

  const inYear = useMemo(
    () => rows.filter((r) => year === "all" || r.date.slice(0, 4) === year),
    [rows, year],
  );
  const filtered = useMemo(
    () => inYear.filter((r) => month === "all" || r.date.slice(5, 7) === month),
    [inYear, month],
  );

  const periodLabel =
    year === "all" && month === "all"
      ? "todo el historial"
      : year === "all"
        ? `${MONTHS[Number(month) - 1]} (todos los años)`
        : month === "all"
          ? year
          : `${MONTHS[Number(month) - 1]} ${year}`;

  // ── Totals for the selected period ──
  const totals = useMemo(() => {
    let earned = 0, booked = 0, discount = 0, nEarned = 0, nBooked = 0;
    for (const r of filtered) {
      discount += r.discount;
      if (r.date <= today) { earned += r.total; nEarned++; }
      else { booked += r.total; nBooked++; }
    }
    const n = filtered.length;
    return { earned, booked, discount, nEarned, nBooked, all: earned + booked, n, avg: n ? (earned + booked) / n : 0 };
  }, [filtered, today]);

  // ── Sets: all time (highlight) and in the selected period (ranking) ──
  const rankSets = (list: ProfitEvent[]) => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const r of list) {
      for (const s of r.sets) {
        const cur = map.get(s.name) ?? { name: s.name, count: 0, revenue: 0 };
        cur.count += s.quantity;
        cur.revenue += s.price * s.quantity;
        map.set(s.name, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  };
  const allTimeSets = useMemo(() => rankSets(rows), [rows]);
  const periodSets = useMemo(() => rankSets(filtered), [filtered]);
  const top = allTimeSets[0];
  const maxCount = Math.max(...periodSets.map((s) => s.count), 1);

  // ── Monthly chart (follows the year filter; the month filter only highlights) ──
  const buckets = useMemo<Bucket[]>(() => {
    if (!inYear.length && year === "all") return [];
    let first: string, last: string;
    if (year === "all") {
      const keys = inYear.map((r) => r.date.slice(0, 7)).sort();
      first = keys[0];
      last = keys[keys.length - 1];
    } else {
      first = `${year}-01`;
      last = `${year}-12`;
    }
    const map = new Map<string, Bucket>();
    for (let k = first; k <= last; k = nextMonth(k)) {
      const [y, m] = k.split("-");
      map.set(k, {
        key: k,
        month: m,
        label: year === "all" ? `${SHORT[Number(m) - 1]} ${y.slice(2)}` : SHORT[Number(m) - 1],
        earned: 0,
        booked: 0,
      });
    }
    for (const r of inYear) {
      const b = map.get(r.date.slice(0, 7));
      if (!b) continue;
      if (r.date <= today) b.earned += r.total;
      else b.booked += r.total;
    }
    return [...map.values()];
  }, [inYear, year, today]);

  // ── Totals per year (shown when "all years") ──
  const perYear = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.date.slice(0, 4), (map.get(r.date.slice(0, 4)) ?? 0) + r.total);
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  // Chart geometry
  const left = 46, top_ = 18, bottom = 30, step = 46, barW = 30, h = 240;
  const plotH = h - top_ - bottom;
  const maxVal = Math.max(...buckets.map((b) => b.earned + b.booked), 1);
  const pow = 10 ** Math.floor(Math.log10(maxVal));
  const niceMax = Math.ceil(maxVal / (pow / 2)) * (pow / 2);
  const width = left + buckets.length * step + 8;
  const y = (v: number) => top_ + plotH - (v / niceMax) * plotH;
  const showValues = buckets.length <= 14;

  const select = "rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm";
  const card = "rounded-2xl border border-violet-200 bg-white p-4 shadow-sm";

  return (
    <div className="mt-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-neutral-600">
          Año{" "}
          <select value={year} onChange={(e) => setYear(e.target.value)} className={select}>
            <option value="all">Todos</option>
            {years.map((yy) => (
              <option key={yy} value={yy}>{yy}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-neutral-600">
          Mes{" "}
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={select}>
            <option value="all">Todos</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
        </label>
        {(year !== "all" || month !== "all") && (
          <button
            type="button"
            onClick={() => { setYear("all"); setMonth("all"); }}
            className="text-sm text-brand hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/* KPIs */}
      <section>
        <h2 className="font-display text-lg font-semibold">Resumen · {periodLabel}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="Ganancias"
            value={money(totals.all)}
            note={
              totals.booked > 0
                ? `${money(totals.earned)} de eventos realizados + ${money(totals.booked)} por realizar`
                : "De eventos ya realizados"
            }
          />
          <Kpi
            title="Eventos"
            value={String(totals.n)}
            note={totals.nBooked > 0 ? `${totals.nEarned} realizados · ${totals.nBooked} por realizar` : undefined}
          />
          <Kpi title="Promedio por evento" value={money(totals.avg)} />
          <Kpi title="Descuentos dados" value={money(totals.discount)} />
        </div>
      </section>

      {/* Best set of all time */}
      {top && (
        <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Set más rentado de la historia
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-accent">{top.name}</p>
          </div>
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-brand">{top.count}</span> {top.count === 1 ? "renta" : "rentas"} ·{" "}
            <span className="font-semibold text-brand">{money(top.revenue)}</span> a precio de lista
          </p>
        </section>
      )}

      {/* Chart */}
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            Ganancias por mes {year === "all" ? "" : `· ${year}`}
          </h2>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-brand" /> Realizados
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-brand/35" /> Por realizar
            </span>
          </div>
        </div>

        {buckets.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No hay eventos en este periodo.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${h}`}
              width={Math.max(width, 320)}
              height={h}
              role="img"
              aria-label="Gráfica de ganancias por mes"
              className="block"
            >
              {[0, 1, 2, 3, 4].map((i) => {
                const v = (niceMax / 4) * i;
                return (
                  <g key={i}>
                    <line x1={left} x2={width - 4} y1={y(v)} y2={y(v)} className="stroke-violet-100" />
                    <text x={left - 6} y={y(v) + 3} textAnchor="end" className="fill-neutral-500" fontSize="10">
                      {compact(v)}
                    </text>
                  </g>
                );
              })}

              {buckets.map((b, i) => {
                const x = left + i * step + (step - barW) / 2;
                const dim = month !== "all" && b.month !== month;
                const earnedH = (b.earned / niceMax) * plotH;
                const bookedH = (b.booked / niceMax) * plotH;
                const total = b.earned + b.booked;
                return (
                  <g key={b.key} opacity={dim ? 0.3 : 1}>
                    <title>{`${MONTHS[Number(b.month) - 1]} ${b.key.slice(0, 4)}: ${money(total)}`}</title>
                    {b.earned > 0 && (
                      <rect x={x} y={y(0) - earnedH} width={barW} height={earnedH} rx="3" className="fill-brand" />
                    )}
                    {b.booked > 0 && (
                      <rect
                        x={x}
                        y={y(0) - earnedH - bookedH}
                        width={barW}
                        height={bookedH}
                        rx="3"
                        className="fill-brand/35"
                      />
                    )}
                    {showValues && total > 0 && (
                      <text
                        x={x + barW / 2}
                        y={y(0) - earnedH - bookedH - 4}
                        textAnchor="middle"
                        fontSize="10"
                        className="fill-neutral-700"
                      >
                        {compact(total)}
                      </text>
                    )}
                    <text x={x + barW / 2} y={h - 10} textAnchor="middle" fontSize="10" className="fill-neutral-500">
                      {b.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        {month !== "all" && buckets.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            Las barras opacas son {MONTHS[Number(month) - 1]}; los demás meses se atenúan.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Sets in the selected period */}
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Sets más rentados · {periodLabel}</h2>
          {periodSets.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No hay sets rentados en este periodo.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {periodSets.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-neutral-500">
                      {s.count} {s.count === 1 ? "renta" : "rentas"} · {money(s.revenue)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-violet-50">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Per year */}
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Total por año</h2>
          <ul className="mt-3 divide-y divide-violet-100 text-sm">
            {perYear.map(([yy, total]) => (
              <li key={yy} className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={() => setYear(yy)}
                  className={`hover:underline ${year === yy ? "font-semibold text-brand" : ""}`}
                >
                  {yy}
                </button>
                <span className="font-medium">{money(total)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
