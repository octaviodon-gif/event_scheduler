import type { Prisma } from "@/generated/prisma/client";
import { dateToDate, eventWindow, shiftDate } from "@/lib/events";

// Two time windows clash if they overlap, counting the buffer needed between events
export function timesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  buffer: number,
) {
  return startA < endB + buffer && startB - buffer < endA;
}

// Free units of every completed purchase for a date and time window:
// units in service minus what other events already reserve at overlapping times
export async function freeUnitsByPurchase(
  tx: Prisma.TransactionClient,
  date: string, // YYYY-MM-DD
  startMin: number,
  endMin: number,
  buffer: number,
  excludeEventNo?: number, // ignore this event's own reservations (used when editing it)
) {
  const [purchases, events] = await Promise.all([
    tx.purchase.findMany({ where: { purchaseStatus: "COMPLETED" } }),
    tx.event.findMany({
      where: {
        // the day before and after too: an event can run past midnight
        date: { gte: dateToDate(shiftDate(date, -1)), lte: dateToDate(shiftDate(date, 1)) },
        ...(excludeEventNo ? { eventNo: { not: excludeEventNo } } : {}),
      },
      include: { items: true },
    }),
  ]);

  const reserved = new Map<string, number>();
  for (const ev of events) {
    const [evStart, evEnd] = eventWindow(ev, date);
    if (!timesOverlap(startMin, endMin, evStart, evEnd, buffer)) {
      continue;
    }
    for (const it of ev.items) {
      reserved.set(it.purchaseId, (reserved.get(it.purchaseId) ?? 0) + it.quantity);
    }
  }

  const free = new Map<string, number>();
  for (const p of purchases) {
    const usable = p.quantity - p.unavailableQuantity - (reserved.get(p.purchaseId) ?? 0);
    free.set(p.purchaseId, Math.max(usable, 0));
  }
  return free;
}
