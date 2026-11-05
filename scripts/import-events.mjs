// Imports the old events from the Google Sheets CSV straight into the database.
// It never touches Google Calendar, so no invitation is sent.
//
//   node scripts/import-events.mjs scripts/eventos.csv             -> DRY RUN: only shows what it would do
//   node scripts/import-events.mjs scripts/eventos.csv --apply     -> really writes to the database
//
// Options: --include-lost  also import the rows whose "Mes Evento" says LOST
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ───────────── Settings you may want to edit ─────────────

// Marks imported events so the app shows "Invite sent" and never offers to send one
const IMPORTED_MARK = "imported";

// The sheet's words for a set -> the names it may have in the app (compared without accents/capitals).
// The first app name that exists is used.
const SET_ALIASES = {
  "set camaleon": ["set camaleon", "camaleon"],
  "set cisne": ["set cisne"],
  "alberca ranita": ["alberca ranita", "set ranita", "ranita"],
  "alberca unicornio": ["alberca unicornio", "set unicornio", "unicornio"],
};

// Rows whose times are wrong or missing in the sheet. CONFIRM THESE.
const TIME_FIXES = {
  3: { start: "12:45", end: "17:45", why: "falta la hora de inicio y el fin dice 5:45 a.m. (supuse 12:45 p.m. - 5:45 p.m.)" },
  50: { start: "14:30", end: "19:30", why: "decia 2:30 a.m. - 7:30 a.m. (supuse p.m.)" },
};

// ───────────── Helpers ─────────────

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Minimal CSV reader (handles quotes, commas and line breaks inside quotes)
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const MONTHS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

function parseDate(s) {
  const m = String(s).trim().toLowerCase().match(/^(\d{1,2})\/([a-z]{3})\/(\d{4})$/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseTime(s) {
  const m = String(s).trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === "p") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const money = (v) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n) => `$${n.toFixed(2)}`;

// ───────────── Planning (pure: no database access) ─────────────
// catalog = { assets: [{id, name, price}], purchases: [{id, name, rentalPrice}], fixedByAsset: Map(assetId -> [{purchaseId, quantity}]) }

export function plan(csvRows, catalog, { today, includeLost = false } = {}) {
  const header = csvRows[0].map(norm);
  const col = (name) => header.indexOf(norm(name));
  const C = {
    no: col("no_evento"), name: col("Nombre Cliente"), phone: col("Tel Cliente"), email: col("Email Cliente"),
    addr: col("Direccion Evento"), notes: col("Notas"), date: col("date"), start: col("start time"),
    end: col("end time"), mob: col("Mobiliario"), down: col("Anticipo"), monthEv: col("Mes Evento"),
    due: col("Adeudo"), disc: col("Descuentos"), total: col("Costo Renta"),
  };
  for (const [k, v] of Object.entries(C)) if (v < 0) throw new Error(`No encuentro la columna "${k}" en el CSV.`);

  const assetsByName = new Map(catalog.assets.map((a) => [norm(a.name), a]));
  const purchasesByName = new Map(catalog.purchases.map((p) => [norm(p.name), p]));

  const events = [];
  const skipped = [];

  for (const r of csvRows.slice(1)) {
    const noRaw = String(r[C.no] ?? "").trim();
    if (!/^\d+$/.test(noRaw)) continue; // blank rows, "Ganancias", the summary at the bottom
    const eventNo = Number(noRaw);
    const flags = [];
    const problems = [];

    if (norm(r[C.monthEv]) === "lost" && !includeLost) {
      skipped.push({ eventNo, customer: String(r[C.name]).trim(), why: "marcado LOST en la hoja (no se importa; usa --include-lost para incluirlo)" });
      continue;
    }

    const lost = norm(r[C.monthEv]) === "lost";
    if (lost) flags.push("cancelado: se importa con total $0 y anticipo devuelto (queda en las notas)");

    const date = parseDate(r[C.date]);
    if (!date) problems.push(`fecha no valida: "${r[C.date]}"`);

    let start = parseTime(r[C.start]);
    let end = parseTime(r[C.end]);
    const fix = TIME_FIXES[eventNo];
    if (fix) { start = fix.start; end = fix.end; flags.push(`horario corregido: ${fix.why}`); }
    if (!start) problems.push("sin hora de inicio");
    if (!end) problems.push("sin hora de fin");
    if (start && end) {
      let dur = mins(end) - mins(start);
      if (dur <= 0) dur += 1440;
      if (dur < 120 || dur > 600) flags.push(`duracion rara (${(dur / 60).toFixed(1)} h)`);
    }

    const customer = String(r[C.name] ?? "").trim();
    const address = String(r[C.addr] ?? "").trim();
    if (!customer) problems.push("sin nombre de cliente");
    if (!address) problems.push("sin direccion");

    // A cancelled event had its deposit refunded: it is stored with $0 so it adds nothing to the totals
    const sheetTotal = money(r[C.total]);
    const sheetDown = money(r[C.down]);
    const total = lost ? 0 : sheetTotal;
    const discount = lost ? 0 : money(r[C.disc]);
    const down = lost ? 0 : sheetDown;
    const due = lost ? 0 : Math.max(money(r[C.due]), 0);
    if (sheetTotal <= 0) problems.push("sin costo de renta");

    // Furniture cell -> sets, extras, and things the app has no item for
    const mobRaw = String(r[C.mob] ?? "").trim();
    const tokens = mobRaw.split(",").map((t) => t.trim()).filter(Boolean);
    const sets = [];
    const extras = new Map(); // purchase -> qty
    const unmatched = [];
    for (const t of tokens) {
      const key = norm(t).replace(/\s*\(\d+\)$/, "");
      if (SET_ALIASES[key]) {
        const hit = SET_ALIASES[key].map((n) => assetsByName.get(norm(n))).find(Boolean);
        if (hit) { if (!sets.includes(hit)) sets.push(hit); }
        else problems.push(`el set "${t}" no existe en la app (busque: ${SET_ALIASES[key].join(" / ")})`);
        continue;
      }
      const ex = key.match(/^(.*?)\s+extra(?:\s+\d+)?$/);
      if (ex) {
        const p = purchasesByName.get(ex[1]);
        if (p) extras.set(p, (extras.get(p) ?? 0) + 1);
        else unmatched.push(t);
        continue;
      }
      unmatched.push(t); // included pieces: they live inside the set, we keep the text in the notes
    }

    // Price reconciliation: sheet total = sets + extras - discount
    const extrasSum = [...extras].reduce((s, [p, q]) => s + q * (p.rentalPrice ?? 0), 0);
    const setPrices = sets.map((a) => a.price);
    let setsSum = setPrices.reduce((s, x) => s + x, 0);
    if (lost) setPrices.fill(0);
    if (!lost && sets.length && Math.abs(setsSum + extrasSum - discount - total) > 0.005) {
      const derived = total + discount - extrasSum - setPrices.slice(1).reduce((s, x) => s + x, 0);
      if (derived > 0) {
        flags.push(`precio del set ajustado a ${fmt(derived)} (hoy el set cuesta ${fmt(setPrices[0])}) para que el total cuadre`);
        setPrices[0] = derived;
        setsSum = setPrices.reduce((s, x) => s + x, 0);
      } else {
        flags.push("los precios no cuadran con el total de la hoja; se guarda el total de la hoja");
      }
    }
    if (!lost && !sets.length && extras.size && Math.abs(extrasSum - discount - total) > 0.005) {
      flags.push(`extras suman ${fmt(extrasSum)} pero la hoja dice ${fmt(total)}; se guarda el total de la hoja`);
    }
    if (!sets.length && !extras.size) problems.push("no encontre ni set ni extras en Mobiliario");

    // Events already held are imported as fully paid (the sheet's "Adeudo" was often never cleaned up
    // after the event). Upcoming events keep the balance the sheet shows.
    const future = date ? date >= today : false;
    const pending = future ? due : 0;
    const sheetDue = !future && due > 0 ? due : 0;

    const sheetNotes = String(r[C.notes] ?? "").trim();
    const notes = [
      lost
        ? `EVENTO CANCELADO (marcado LOST en la hoja). Anticipo devuelto: ${fmt(sheetDown)}. Costo original: ${fmt(sheetTotal)}.`
        : "",
      sheetNotes,
      `Mobiliario (hoja): ${mobRaw}`,
    ].filter(Boolean).join("\n\n");

    events.push({
      eventNo, customer, phone: String(r[C.phone] ?? "").replace(/\D/g, "").slice(0, 20),
      email: String(r[C.email] ?? "").trim() || null, address, notes, date, start, end,
      down, discount, total, pending, sheetDue, paymentComplete: pending === 0,
      sets: sets.map((a, i) => ({ asset: a, price: setPrices[i] })),
      extras: [...extras].map(([p, q]) => ({ purchase: p, quantity: q })),
      unmatched, future, flags, problems,
    });
  }
  return { events, skipped };
}

// ───────────── Report ─────────────

function report({ events, skipped }) {
  const ok = events.filter((e) => !e.problems.length);
  const bad = events.filter((e) => e.problems.length);
  console.log(`\nEventos leidos: ${events.length + skipped.length}  |  listos para importar: ${ok.length}  |  con problemas: ${bad.length}  |  omitidos: ${skipped.length}\n`);

  for (const e of ok) {
    const what = [...e.sets.map((s) => s.asset.name), ...e.extras.map((x) => `${x.purchase.name} x${x.quantity} (extra)`)].join(" + ");
    console.log(`#${String(e.eventNo).padStart(2)}  ${e.date} ${e.start}-${e.end}  ${e.customer.slice(0, 28).padEnd(28)}  ${what}`);
    console.log(`      total ${fmt(e.total)}  descuento ${fmt(e.discount)}  anticipo ${fmt(e.down)}  pendiente ${fmt(e.pending)}${e.future ? "  [FUTURO]" : ""}`);
    for (const f of e.flags) console.log(`      ! ${f}`);
  }
  if (bad.length) {
    console.log("\n=== NO SE IMPORTARAN (arregla la hoja o la configuracion) ===");
    for (const e of bad) console.log(`#${e.eventNo} ${e.customer}: ${e.problems.join("; ")}`);
  }
  if (skipped.length) {
    console.log("\n=== OMITIDOS ===");
    for (const s of skipped) console.log(`#${s.eventNo} ${s.customer}: ${s.why}`);
  }
  const stale = ok.filter((e) => e.sheetDue > 0);
  if (stale.length) {
    console.log("\n=== EVENTOS PASADOS QUE LA HOJA AUN MOSTRABA CON SALDO (se importan como pagados) ===");
    console.log(stale.map((e) => `#${e.eventNo} ${fmt(e.sheetDue)}`).join(", "));
    console.log("Si alguno de verdad quedo debiendo, dimelo y lo dejo con saldo.");
  }
  const fut = ok.filter((e) => e.future);
  if (fut.length) {
    console.log("\n=== EVENTOS FUTUROS ===");
    console.log("Se reserva solo lo fijo del set (y los extras). Las piezas que se escogen (inflables, pelotas, montana rusa, toldo) no se reservan automaticamente:");
    for (const e of fut) console.log(`#${e.eventNo} ${e.date} ${e.customer}: ${e.unmatched.join(", ")}`);
  }
  const nums = events.concat(skipped).map((e) => e.eventNo).sort((a, b) => a - b);
  const gaps = [];
  for (let n = 1; n <= nums[nums.length - 1]; n++) if (!nums.includes(n)) gaps.push(n);
  if (gaps.length) console.log(`\nNumeros de evento que no existen en la hoja: ${gaps.join(", ")}`);
}

// ───────────── Main ─────────────

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--")) ?? "scripts/eventos.csv";
  const APPLY = args.includes("--apply");
  const includeLost = args.includes("--include-lost");

  if (!fs.existsSync(file)) { console.error(`No encuentro el archivo ${file}`); process.exit(1); }

  // .env -> process.env (only the keys not already set)
  if (fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL en .env"); process.exit(1); }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const assets = (await client.query("SELECT asset_id, asset_name, asset_price FROM assets")).rows
      .map((r) => ({ id: r.asset_id, name: r.asset_name, price: Number(r.asset_price) }));
    const purchases = (await client.query("SELECT purchase_id, asset_name, rental_price FROM purchases")).rows
      .map((r) => ({ id: r.purchase_id, name: r.asset_name, rentalPrice: r.rental_price == null ? null : Number(r.rental_price) }));
    const fixedRows = (await client.query("SELECT asset_id, purchase_id, quantity FROM asset_fixed_items")).rows;
    const existing = Number((await client.query("SELECT count(*) FROM events")).rows[0].count);

    console.log(`Sets en la app: ${assets.map((a) => a.name).join(", ") || "(ninguno)"}`);
    console.log(`Articulos en la app: ${purchases.length}`);
    if (existing > 0) console.log(`AVISO: la tabla de eventos ya tiene ${existing} registros.`);

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const csvRows = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
    const result = plan(csvRows, { assets, purchases }, { today, includeLost });
    report(result);

    if (!APPLY) {
      console.log("\n>>> PRUEBA: no se guardo nada. Si todo se ve bien, corre de nuevo con --apply");
      return;
    }
    if (existing > 0) {
      console.error("\nNo se importa: la tabla de eventos no esta vacia. Vaciala primero (TRUNCATE ... events) o avisame.");
      process.exit(1);
    }
    const toImport = result.events.filter((e) => !e.problems.length);
    if (!toImport.length) { console.error("No hay eventos para importar."); process.exit(1); }

    const fixedByAsset = new Map();
    for (const f of fixedRows) fixedByAsset.set(f.asset_id, [...(fixedByAsset.get(f.asset_id) ?? []), f]);

    await client.query("BEGIN");
    for (const e of toImport) {
      await client.query(
        `INSERT INTO events (event_no, customer_name, customer_phone, customer_email, event_address, notes,
           "date", start_time, end_time, down_payment_amount, payment_complete, pending_payment, discount,
           rent_total_price, google_event_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now(), now())`,
        [e.eventNo, e.customer, e.phone, e.email, e.address, e.notes, e.date, `${e.start}:00`, `${e.end}:00`,
         e.down, e.paymentComplete, e.pending, e.discount, e.total, IMPORTED_MARK],
      );
      for (const s of e.sets) {
        await client.query(
          "INSERT INTO event_assets (event_no, asset_id, quantity, price) VALUES ($1,$2,1,$3)",
          [e.eventNo, s.asset.id, s.price],
        );
        if (e.future) {
          for (const f of fixedByAsset.get(s.asset.id) ?? []) {
            await client.query(
              `INSERT INTO event_items (event_no, purchase_id, kind, quantity, unit_price)
               VALUES ($1,$2,'set_fixed'::event_item_kind,$3,NULL) ON CONFLICT DO NOTHING`,
              [e.eventNo, f.purchase_id, f.quantity],
            );
          }
        }
      }
      for (const x of e.extras) {
        await client.query(
          `INSERT INTO event_items (event_no, purchase_id, kind, quantity, unit_price)
           VALUES ($1,$2,'extra'::event_item_kind,$3,$4)`,
          [e.eventNo, x.purchase.id, x.quantity, x.purchase.rentalPrice],
        );
      }
    }
    // the next event created in the app continues after the highest imported number
    await client.query("SELECT setval(pg_get_serial_sequence('events','event_no'), (SELECT max(event_no) FROM events))");
    await client.query("COMMIT");
    console.log(`\n>>> LISTO: ${toImport.length} eventos importados. Ninguna invitacion fue enviada.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\nError, no se guardo nada:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
