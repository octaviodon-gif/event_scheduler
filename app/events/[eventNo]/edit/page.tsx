import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getEventCatalog } from "@/lib/event-catalog";
import { freeUnitsByPurchase } from "@/lib/availability";
import {
  formatEventNo,
  minutesOfDay,
  toDateString,
  toTimeString,
} from "@/lib/events";
import { getSettings } from "@/lib/settings";
import EventForm, { type EventInitial } from "../../event-form";

export const instant = false;

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventNo: string }>;
}) {
  const { eventNo } = await params;
  const n = Number(eventNo);
  if (!Number.isInteger(n) || n < 1) notFound();

  const ev = await prisma.event.findUnique({
    where: { eventNo: n },
    include: { assets: true, items: true },
  });
  if (!ev) notFound();

  const s = await getSettings();
  const date = toDateString(ev.date);
  const startMin = minutesOfDay(ev.startTime);

  const [catalog, free] = await Promise.all([
    getEventCatalog(ev.items.map((i) => i.purchaseId)),
    // what is free at the event's own time, not counting the event itself
    freeUnitsByPurchase(prisma, date, startMin, startMin + s.durationMinutes, s.bufferMinutes, ev.eventNo),
  ]);

  const extras = ev.items.filter((i) => i.kind === "EXTRA");
  const extrasSum = extras.reduce(
    (sum, i) => sum.add((i.unitPrice ?? new Prisma.Decimal(0)).mul(i.quantity)),
    new Prisma.Decimal(0),
  );
  const oldSet = ev.assets[0];
  const derived = ev.rentTotalPrice.add(ev.discount).sub(extrasSum); // for events booked before set prices were stored
  const setPrice = oldSet ? (oldSet.price ?? (derived.gte(0) ? derived : null)) : null;

  const initial: EventInitial = {
    customerName: ev.customerName,
    customerPhone: ev.customerPhone,
    customerEmail: ev.customerEmail ?? "",
    eventAddress: ev.eventAddress,
    notes: ev.notes ?? "",
    date,
    start: toTimeString(ev.startTime),
    setId: oldSet?.assetId ?? "",
    setPrice: setPrice ? setPrice.toFixed(2) : null,
    picks: ev.items
      .filter((i) => i.kind === "SET_PICK")
      .flatMap((i) => Array.from({ length: i.quantity }, () => i.purchaseId)),
    extras: extras.map((i) => ({
      item: i.purchaseId,
      qty: i.quantity,
      unitPrice: i.unitPrice ? i.unitPrice.toFixed(2) : null,
    })),
    discount: ev.discount.isZero() ? "" : ev.discount.toFixed(2),
    down: ev.downPaymentAmount.toFixed(2),
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link href={`/events/${ev.eventNo}`} className="text-sm text-neutral-500 hover:underline">
        ← {formatEventNo(ev.eventNo, s.eventPrefix)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit {formatEventNo(ev.eventNo, s.eventPrefix)}</h1>

      <section className="mt-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
        <EventForm
          nextNo={formatEventNo(ev.eventNo, s.eventPrefix)}
          sets={catalog.sets}
          items={catalog.items}
          durationMinutes={s.durationMinutes}
          edit={{ eventNo: ev.eventNo, initial, initialFree: Object.fromEntries(free) }}
        />
      </section>
    </main>
  );
}
