import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import ProfitsView, { type ProfitEvent } from "./profits-view";

export const instant = false;

export default async function ProfitsPage() {
  const s = await getSettings();
  // "today" in the business timezone: events up to today count as earned, later ones as booked
  const today = new Date().toLocaleDateString("en-CA", { timeZone: s.timezone });

  const events = await prisma.event.findMany({
    where: { rentTotalPrice: { gt: 0 } }, // cancelled events are stored with $0
    include: { assets: { include: { asset: true } } },
    orderBy: { date: "asc" },
  });

  const rows: ProfitEvent[] = events.map((ev) => ({
    eventNo: ev.eventNo,
    date: toDateString(ev.date),
    total: Number(ev.rentTotalPrice),
    discount: Number(ev.discount),
    sets: ev.assets.map((a) => ({
      name: a.asset.assetName,
      quantity: a.quantity,
      price: a.price == null ? 0 : Number(a.price),
    })),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Ganancias</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Suma del costo de renta de tus eventos (ya con descuentos). Los eventos cancelados no cuentan.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">Todavía no hay eventos registrados.</p>
      ) : (
        <ProfitsView rows={rows} today={today} />
      )}
    </main>
  );
}
